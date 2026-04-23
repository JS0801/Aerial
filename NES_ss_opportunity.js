/**
 * Module Description
 * 
 * Version    Date            Author           Remarks
 * 1.00       08 Apr 2019     Steve
 *
 */

/**
 * The recordType (internal id) corresponds to the "Applied To" record in your script deployment. 
 * @appliedtorecord recordType
 * 
 * @param {String} type Operation types: create, edit, delete, xedit,
 *                      approve, cancel, reject (SO, ER, Time Bill, PO & RMA only)
 *                      pack, ship (IF only)
 *                      dropship, specialorder, orderitems (PO only) 
 *                      paybills (vendor payments)
 * @returns {Void}
 */
function userEventBeforeSubmit(type){
	 
	 var lines = nlapiGetLineItemCount('item');
	 for(var x = 1; x <= lines; x++)
		 {
		 var job = nlapiGetLineItemValue('item', 'job', x);
		 nlapiSetLineItemValue('item', 'custcol_project_link', x, job);
		 var amount = nlapiGetLineItemValue('item', 'amount', x);
		 var status = nlapiGetLineItemValue('item', 'custcol_line_probability', x);
		 if(status != '' && status != null)
		 {
		 var prob = nlapiLookupField('customerstatus', status, 'probability');
		 var weight = (amount*prob)/100;
		 weight = Number(weight).toFixed(2);
		 nlapiSetLineItemValue('item', 'custcol_weighted_amount', x, weight);
		 }
		 }
}


function userEventAfterSubmit(type){

  var id = nlapiGetRecordId();
  var soRec = nlapiLoadRecord('opportunity', id);
  var lines = soRec.getLineItemCount('item');
  var entityStatus = soRec.getFieldValue('entitystatus');
  nlapiLogExecution('DEBUG', 'Entity Status', entityStatus);
  var totWeight = 0;
  var total = 0;
  var oppClosed = true;
  
  if(lines == 0)
	  {
	  soRec.setFieldValue('custbody_opp_status', '1');
	  var status = soRec.getFieldValue('entitystatus');
	  var projTot = soRec.getFieldValue('projectedtotal');
      var prob = nlapiLookupField('customerstatus', status, 'probability');
	  totWeight = (projTot*prob)/100;
	  totWeight = Number(totWeight).toFixed(2);
	  }
  else
{
  for(var x = 1; x <= lines; x++)
	  {
      var proj = nlapiGetLineItemValue('item', 'custcol_project_link', x);
	  if(proj != '' && proj != null)
		  {
		  var itemName = nlapiGetLineItemText('item', 'item', x);
		  nlapiSubmitField('job', proj, 'custentity66', id);
		  
		  if(itemName.indexOf('Materials') == '-1')  
		  {nlapiSubmitField('job', proj, 'custentity_qty_facilitators', nlapiGetLineItemValue('item', 'quantity', x));}
		  }
	  var lineStat = nlapiGetLineItemValue('item', 'custcol_line_probability', x);
	  if(lineStat != '13' && lineStat != '16')
		  {
		  oppClosed = false;
		  }
	  
      var lineId = nlapiGetLineItemValue('item', 'custcol_line_number', x);
	  if(lineId == '' || lineId == null || type == 'create' || type == 'copy')
		  {
		  soRec.setLineItemValue('item', 'custcol_line_number', x, id + '-' + x);
		  soRec.setFieldValue('custbody_opp_status', '2');
		  }
	  total = Number(total) + Number(soRec.getLineItemValue('item', 'amount', x));
	  totWeight = Number(totWeight) + Number(soRec.getLineItemValue('item', 'custcol_weighted_amount', x));
	  }
  
  if(entityStatus == '16' || oppClosed== true)
	  {
	  soRec.setFieldValue('custbody_opp_status', '3');
	  }
}
  
  soRec.setFieldValue('custbody_tot_scheduled', total);
  soRec.setFieldValue('custbody_tot_weight', totWeight);
  
  nlapiSubmitRecord(soRec);
}



function beforeLoad(type){
	var newwin = 'New window';
	
	if(type == 'view')
	{
	  var id = nlapiGetRecordId();
	  var stClientId = nlapiGetFieldValue('entity');
	  var stProgramName = nlapiLookupField('customer', stClientId, 'companyname');
	  var stStartDate = nlapiGetFieldValue('expectedclosedate');
	  var stProjectedEndDate = '';
	  var stClientProgramName = '';
	  var stProjectRegion = '';
	  var stURLParameters='';
      var urlParameters = {
	            'custpage_winpopup': 'T', // window popup | remove navigation bar
	            'custpage_launchmode': "opportunity",
	            'custpage_programid': id,
	            'custpage_startdate': encodeURIComponent(stStartDate),
	            'custpage_enddate': encodeURIComponent(stProjectedEndDate),
				'custpage_client' : stClientId,
				'custpage_programname' : encodeURIComponent(stProgramName),
				'custpage_clientprogramname' : encodeURIComponent(stClientProgramName),
				'custpage_region' : stProjectRegion
	        }
	        
	        // generate query string
	        for (i in urlParameters)
	        {
	            stURLParameters +='&'+i+'='+urlParameters[i];
	        }
	        
	  var empAvailUrl = nlapiResolveURL('SUITELET','customscript_employee_availability','customdeploy_employee_availability')+stURLParameters;
	  var empAvailScript = "window.open('"  + empAvailUrl + "','','"  + newwin + "', '_self', 'fullscreen=yes')";
	  var contractUrl = nlapiResolveURL('SUITELET','customscript_nes_suit_print_contract','customdeploy_nes_suit_print_contract') + '&custparam_oppId=' + id;
	  var contractScript = "window.open('"  + contractUrl  + "','','"  + newwin + "', '_self', 'fullscreen=yes')";
	  var statusArr = ['19', '12', '13'];
	  var soRec = nlapiLoadRecord('opportunity', id);
	  var lines = soRec.getLineItemCount('item');
	  var total = 0;
	  nlapiLogExecution('DEBUG', 'Lines', lines);
	  for(var x = 1; x <= lines; x++)
		  {
		  var status = nlapiGetLineItemValue('item', 'custcol_line_probability', x);
		  if(statusArr.indexOf(status) != '-1')
			  {
			  form.addButton('custpage_emp_avail', 'Employee Availability', empAvailScript);
			  form.addButton('custpage_contract', 'Print Contract', contractScript);
			  break;
			  }
		  }
	  

	}
//  	if(type != 'view' || type != 'delete')
//		{
//		var qtyFld = nlapiGetLineItemField('item', 'quantity', 1);
//		qtyFld.setMandatory(true);
//}
}

        
        
function windowOpener(windowUri,windowWidth,windowHeight)
{
    var windowName = "PopUp";
    var centerWidth = (window.screen.width - windowWidth) / 2;
    var centerHeight = (window.screen.height - windowHeight) / 2;

    newWindow = window.open(windowUri, windowName, 'resizable=1,width=' + windowWidth +
        ',height=' + windowHeight +
        ',left=' + centerWidth +
        ',top=' + centerHeight +
        ',scrollbars=yes');

    newWindow.focus();
    return newWindow.name;
}