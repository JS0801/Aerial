/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * 06/17/2016 Kalyani Chintala, DSG Case 56456
 */
define(['N/record'],
/**
 * @param {record} record
 */
function(record) {
   
    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {string} scriptContext.type - Trigger type
     * @param {Form} scriptContext.form - Current form
     * @Since 2015.2
     */
    function beforeLoad(scriptContext) {

    }

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type
     * @Since 2015.2
     */
    function beforeSubmit(scriptContext) 
    {
    	
    }

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type
     * @Since 2015.2
     */
    function afterSubmit(scriptContext) 
    {
    	if(scriptContext.type == scriptContext.UserEventType.CREATE)
    	{
    		var newRec = scriptContext.newRecord;
    		var currRec = record.load({type: newRec.type, id: newRec.id, isDynamic: true});
    		var oppProg = currRec.getValue({fieldId: 'custbody_opptyprogram'});
    		var projTotal = currRec.getValue({fieldId: 'projectedtotal'});
    		if(currRec.getLineCount({sublistId: 'item'}) == 0 && oppProg != null && oppProg != '')
    		{
    			currRec.selectNewLine({sublistId: 'item'});
    			currRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'item', value: oppProg});
    			currRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'quantity', value: 1});
    			currRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'price', value: '-1'});
    			currRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'amount', value: projTotal});
    			currRec.commitLine({sublistId: 'item'});
    		}
    		currRec.save({ignoreMandatoryFields: true, enableSourcing: true});
    	}
    }

    return {
        //beforeLoad: beforeLoad,
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    };
    
});
