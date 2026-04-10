/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */

define(['N/search', 'N/file', 'N/log', 'N/record'], (search, file, log, record) => {

    // ─── existing GET function ───
    const getAttachments = (request) => {

        try {
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
            log.debug('searchResultCount', searchResultCount);
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
            
            return JSON.stringify({ 
                success: true,
                tranId: soId,
                count: attachments.length,
                attachments: attachments
            });

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

            if (request.tranId) {
                log.debug('Fetching Document')
                return getAttachments(request);
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
    const contacts = request.contacts || [];

    log.debug('oppExternalId', oppExternalId);

    if (!oppExternalId) {
        return { success: false, message: 'opportunityExternalId is required' };
    }

    if (!contacts.length) {
        return { success: false, message: 'contacts array is required' };
    }

    // lookup opportunity by external id
    const oppSearch = search.create({
        type: 'opportunity',
        filters: [
            ['externalidstring', 'is', oppExternalId]
        ],
        columns: ['internalid', 'entity']
    });

    let oppId = null;
    let companyId = null;

    oppSearch.run().each(result => {
        oppId = result.getValue({ name: 'internalid' });
        companyId = result.getValue({ name: 'entity' });
        return false;
    });

    log.debug('Opportunity Lookup', {
        oppId: oppId,
        companyId: companyId
    });

    if (!oppId) {
        return {
            success: false,
            message: 'Opportunity not found for externalId: ' + oppExternalId
        };
    }

    const results = [];

    for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];

        try {
            let contactId = null;
            let isUpdate = false;

            // find existing contact by external id
            if (contact.externalId) {
                const contactSearch = search.create({
                    type: search.Type.CONTACT,
                    filters: [
                        ['externalidstring', 'is', contact.externalId]
                    ],
                    columns: ['internalid']
                });

                contactSearch.run().each(result => {
                    contactId = result.getValue({ name: 'internalid' });
                    return false;
                });
            }

            let contactRec;

            if (contactId) {
                isUpdate = true;
                contactRec = record.load({
                    type: record.Type.CONTACT,
                    id: contactId,
                    isDynamic: true
                });
                log.debug('Existing Contact Found', {
                    externalId: contact.externalId,
                    contactId: contactId
                });
            } else {
                contactRec = record.create({
                    type: record.Type.CONTACT,
                    isDynamic: true
                });
                log.debug('Creating New Contact', {
                    externalId: contact.externalId
                });

                if (contact.externalId) {
                    contactRec.setValue({
                        fieldId: 'externalid',
                        value: contact.externalId
                    });
                }
            }

            // set/update company
            if (companyId) {
                contactRec.setValue({
                    fieldId: 'company',
                    value: companyId
                });
            }

            if (contact.firstName !== undefined && contact.firstName !== null) {
                contactRec.setValue({
                    fieldId: 'firstname',
                    value: contact.firstName
                });
            }

            if (contact.lastName !== undefined && contact.lastName !== null) {
                contactRec.setValue({
                    fieldId: 'lastname',
                    value: contact.lastName
                });
            }

            if (contact.title !== undefined && contact.title !== null) {
                contactRec.setValue({
                    fieldId: 'title',
                    value: contact.title
                });
            }

            if (contact.email !== undefined && contact.email !== null) {
                contactRec.setValue({
                    fieldId: 'email',
                    value: contact.email
                });
            }

            if (contact.phone !== undefined && contact.phone !== null) {
                contactRec.setValue({
                    fieldId: 'phone',
                    value: contact.phone
                });
            }

            if (contact.mobile !== undefined && contact.mobile !== null) {
                contactRec.setValue({
                    fieldId: 'mobilephone',
                    value: contact.mobile
                });
            }

            contactId = contactRec.save({
                enableSourcing: false,
                ignoreMandatoryFields: true
            });

            log.debug(isUpdate ? 'Contact Updated' : 'Contact Created', {
                contactId: contactId,
                externalId: contact.externalId
            });

            // load again only if addresses need to be added
            if (contact.addresses && contact.addresses.length) {
                const contactWithAddress = record.load({
                    type: record.Type.CONTACT,
                    id: contactId,
                    isDynamic: true
                });

                for (let j = 0; j < contact.addresses.length; j++) {
                    addAddressToContact(contactWithAddress, contact.addresses[j]);
                }

                contactId = contactWithAddress.save({
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                });

                log.debug('Addresses Updated', {
                    contactId: contactId,
                    addressCount: contact.addresses.length
                });
            }

            // attach contact to opportunity
            try {
                record.attach({
                    record: { type: 'contact', id: contactId },
                    to: { type: 'opportunity', id: oppId }
                });

                log.debug('Contact Attached to Opportunity', {
                    contactId: contactId,
                    oppId: oppId
                });
            } catch (attachErr) {
                log.error('Attach Error', attachErr);
            }

            results.push({
                externalId: contact.externalId,
                contactId: contactId,
                action: isUpdate ? 'updated' : 'created',
                success: true
            });

        } catch (e) {
            log.error('Contact Create/Update Error', {
                externalId: contact.externalId,
                error: e
            });

            results.push({
                externalId: contact.externalId,
                success: false,
                message: e.message
            });
        }
    }

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

    
  const addAddressToContact = (contactRec, addr) => {
    contactRec.selectNewLine({ sublistId: 'addressbook' });

    const toBoolean = (val) => {
        return val === true || val === 'T' || val === 'true' || val === '1' || val === 1;
    };

    if (addr.defaultShipping !== undefined) {
        log.debug('addr.defaultShipping', addr.defaultShipping);
        contactRec.setCurrentSublistValue({
            sublistId: 'addressbook',
            fieldId: 'defaultshipping',
            value: toBoolean(addr.defaultShipping)
        });
    }

    if (addr.defaultBilling !== undefined) {
        log.debug('addr.defaultBilling', addr.defaultBilling);
        contactRec.setCurrentSublistValue({
            sublistId: 'addressbook',
            fieldId: 'defaultbilling',
            value: toBoolean(addr.defaultBilling)
        });
    }

    if (addr.label) {
        contactRec.setCurrentSublistValue({
            sublistId: 'addressbook',
            fieldId: 'label',
            value: addr.label
        });
    }

    const addrSubrecord = contactRec.getCurrentSublistSubrecord({
        sublistId: 'addressbook',
        fieldId: 'addressbookaddress'
    });

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
       // get: getAttachments,
        post: handlePost
    };

});