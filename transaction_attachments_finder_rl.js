/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */

define(['N/search', 'N/file', 'N/log'], (search, file, log) => {

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
            log.debug('salesorderSearchObj', salesorderSearchObj);

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

    return {
        get: getAttachments,
        post: getAttachments
    };

});