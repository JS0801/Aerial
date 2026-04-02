/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */

define(['N/search', 'N/file', 'N/log', 'N/record'], (search, file, log, record) => {

    // ─── existing GET function ───
    const getAttachments = (request) => {

        try {

          log.debug('request', request)

            const soId = request.tranId;
            log.debug('soId', soId);

            if (!soId) {
                return {
                    success: false,
                    message: 'tranId is required'
                };
            }

            

            let attachments = [];

            const salesorderSearchObj = search.create({
                type: "transaction",
                filters: [
                    ["internalid","anyof", soId],
                    "AND",
                    ["mainline","is","T"]
                ],
                columns: [
                    search.createColumn({name: "tranid"}),
                    search.createColumn({
                        name: "internalid",
                        join: "file"
                    }),
                    search.createColumn({
                        name: "name",
                        join: "file"
                    }),
                    search.createColumn({
                        name: "modified",
                        join: "file"
                    })
                ]
            });

            const searchResultCount = salesorderSearchObj.runPaged().count;
            
            salesorderSearchObj.run().each(result => {
                log.debug('result', result);

                const fileId = result.getValue({
                    name: "internalid",
                    join: "file"
                });

                const fileName = result.getValue({
                    name: "name",
                    join: "file"
                });

                log.debug('logger', {
                  fileId: fileId,
                  fileName: fileName
                })

                const modified = result.getValue({
                    name: "modified",
                    join: "file"
                });

                if (fileId) {

                    try {

                        const fileObj = file.load({ id: fileId });

                        attachments.push({
                            fileId: fileId,
                            name: fileName,
                            modified: modified,
                            fileType: fileObj.fileType,
                            size: fileObj.size,
                            url: fileObj.url,
                            content: fileObj.getContents()
                        });

                    } catch (e) {

                        log.error("File Load Error", e);

                        attachments.push({
                            fileId: fileId,
                            name: fileName,
                            error: "Unable to load file"
                        });
                    }
                }

                return true;
            });
            log.debug('searchResultCount', searchResultCount);
            return { 
                success: true,
                tranId: soId,
                count: attachments.length,
                attachments: attachments
            };

        } catch (e) {

            log.error("Restlet Error", e);

            return {
                success: false,
                message: e.message
            };
        }
    };

    // ─── POST function ───
    const handlePost = (request) => {
        try {
            log.debug('POST Request', JSON.stringify(request));

            if (request.contactInternalId) {
                log.debug('Updating Contact')
                return updateContactAddresses(request);
            }

            if (request.opportunityExternalId) {
                log.debug('Creating Contact')
                return createContactsForOpportunity(request);
            }

            return { success: false, message: 'Either contactInternalId or opportunityExternalId is required' };

        } catch (e) {
            log.error('POST Error', e);
            return { success: false, message: e.message };
        }
    };

    // ─── Create contacts and attach to opportunity ───
    const createContactsForOpportunity = (request) => {
        const oppExternalId = request.opportunityExternalId;
        log.debug('oppExternalId', oppExternalId)
        const contacts = request.contacts || [];

        if (!contacts.length) {
            return { success: false, message: 'contacts array is required' };
        }

        // lookup opportunity by externalid to get internal id and parent company
        const oppSearch = search.create({
            type: 'opportunity',
            filters: [['externalid', 'anyof', oppExternalId]],
            columns: ['internalid', 'entity']
        });

        let oppId = null;
        let companyId = null;

        oppSearch.run().each(result => {
            oppId = result.getValue('internalid');
            companyId = result.getValue('entity');
            return false; // first result only
        });

        log.debug('Opportunity Lookup', { oppId: oppId, companyId: companyId });

        if (!oppId) {
            return { success: false, message: 'Opportunity not found for externalId: ' + oppExternalId };
        }

        let results = [];

        contacts.forEach(contact => {
            try {
                const contactRec = record.create({ type: record.Type.CONTACT });

                // set company so contact is linked to the customer
                if (companyId) {
                    contactRec.setValue({ fieldId: 'company', value: companyId });
                }

                if (contact.externalId) {
                    contactRec.setValue({ fieldId: 'externalid', value: contact.externalId });
                }
                if (contact.firstName) {
                    contactRec.setValue({ fieldId: 'firstname', value: contact.firstName });
                }
                if (contact.lastName) {
                    contactRec.setValue({ fieldId: 'lastname', value: contact.lastName });
                }
                if (contact.title) {
                    contactRec.setValue({ fieldId: 'title', value: contact.title });
                }
                if (contact.email) {
                    contactRec.setValue({ fieldId: 'email', value: contact.email });
                }
                if (contact.phone) {
                    contactRec.setValue({ fieldId: 'phone', value: contact.phone });
                }
                if (contact.mobile) {
                    contactRec.setValue({ fieldId: 'mobilephone', value: contact.mobile });
                }

                var contactId = contactRec.save({ enableSourcing: false, ignoreMandatoryFields: true });
                const contactRecord = record.load({ type: record.Type.CONTACT, id: contactId, isDynamic: true });
                log.debug('Loaded Contact', { contactId: contactId });

                // add addresses if provided
                if (contact.addresses && contact.addresses.length) {
                    contact.addresses.forEach(addr => {
                        addAddressToContact(contactRecord, addr);
                    });
                }

                contactId = contactRecord.save({ enableSourcing: false, ignoreMandatoryFields: true });
                log.debug('Contact Created', { contactId: contactId, name: contact.firstName + ' ' + contact.lastName });

                // attach contact to opportunity
                record.attach({
                    record: { type: 'contact', id: contactId },
                    to: { type: 'opportunity', id: oppId }
                });
                log.debug('Contact Attached', { contactId: contactId, oppId: oppId });

                results.push({
                    externalId: contact.externalId,
                    contactId: contactId,
                    success: true
                });

            } catch (e) {
                log.error('Contact Create Error', e);
                results.push({
                    externalId: contact.externalId,
                    success: false,
                    message: e.message
                });
            }
        });

        return {
            success: true,
            opportunityId: oppId,
            results: results
        };
    };

    // ─── Update addresses on existing contact ───
    const updateContactAddresses = (request) => {
        const contactId = request.contactInternalId;
        const addresses = request.addresses || [];

        if (!addresses.length) {
            return { success: false, message: 'contacts (addresses) array is required' };
        }

        const contactRec = record.load({ type: record.Type.CONTACT, id: contactId, isDynamic: true });
        log.debug('Loaded Contact', { contactId: contactId });

        addresses.forEach(addr => {
            addAddressToContact(contactRec, addr);
        });

        const savedId = contactRec.save({ enableSourcing: false, ignoreMandatoryFields: true });
        log.debug('Contact Addresses Updated', { contactId: savedId });

        return {
            success: true,
            contactId: savedId,
            addressCount: addresses.length
        };
    };

    // ─── Helper: add one address line to contact record ───
    const addAddressToContact = (contactRec, addr) => {
        contactRec.selectNewLine({ sublistId: 'addressbook' });

        if (addr.defaultShipping !== undefined) {
            contactRec.setCurrentSublistValue({ sublistId: 'addressbook', fieldId: 'defaultshipping', value: addr.defaultShipping });
        }
        if (addr.defaultBilling !== undefined) {
            contactRec.setCurrentSublistValue({ sublistId: 'addressbook', fieldId: 'defaultbilling', value: addr.defaultBilling });
        }
        if (addr.label) {
            contactRec.setCurrentSublistValue({ sublistId: 'addressbook', fieldId: 'label', value: addr.label });
        }

        // get the address subrecord
        const addrSubrecord = contactRec.getCurrentSublistSubrecord({ sublistId: 'addressbook', fieldId: 'addressbookaddress' });

        if (addr.attention) addrSubrecord.setValue({ fieldId: 'attention', value: addr.attention });
        if (addr.addressee) addrSubrecord.setValue({ fieldId: 'addressee', value: addr.addressee });
        if (addr.phone) addrSubrecord.setValue({ fieldId: 'addrphone', value: addr.phone });
        if (addr.addr1) addrSubrecord.setValue({ fieldId: 'addr1', value: addr.addr1 });
        if (addr.addr2) addrSubrecord.setValue({ fieldId: 'addr2', value: addr.addr2 });
        if (addr.city) addrSubrecord.setValue({ fieldId: 'city', value: addr.city });
        if (addr.state) addrSubrecord.setValue({ fieldId: 'state', value: addr.state });
        if (addr.zip) addrSubrecord.setValue({ fieldId: 'zip', value: addr.zip });
        if (addr.country) addrSubrecord.setValue({ fieldId: 'country', value: addr.country });

        contactRec.commitLine({ sublistId: 'addressbook' });
        log.debug('Address Added', { addressee: addr.addressee, city: addr.city });
    };


    return {
        get: getAttachments,
        post: handlePost
    };

});