'use strict'


//import { access } from "fs";

/* global $, jQuery, window */
/* eslint-env es6, quotes:single */

// Handles payment flow communication to Vend via the Payments API.
// Documentation: https://docs.vendhq.com/docs/payments-api-reference

// Send postMessage JSON payload to the Payments API.
function sendObjectToVend(object) {
    // Define parent/opener window.
    var receiver = window.opener !== null ? window.opener : window.parent
    // Send JSON object to parent/opener window.
    receiver.postMessage(JSON.stringify(object), '*')
}
function sendObjectToVendForFiscalPrint(object) {
    // Define parent/opener window.
    var receiver = window.opener !== null ? window.opener : window.parent
    // Send JSON object to parent/opener window.
    receiver.postMessage(JSON.stringify(object), '*')

}

// Payments API Steps.
// https://docs.vendhq.com/docs/payments-api-reference#section-required
// ACCEPT: Trigger a successful transaction. If the payment type supports
// printing (and it is enabled) an approved transaction receipt will also print,
// containing any of the addition receipt_html_extra that is specified.
//
// DESIRED STATE: The transaction_id of the external payment provider can be
// specified, and later retrieved via the REST API.
function acceptStep(receiptHTML, transactionID) {
    console.log('sending ACCEPT step')
    sendObjectToVend({
        step: 'ACCEPT',
        transaction_id: transactionID,
        receipt_html_extra: receiptHTML
    })
}

// DATA: Request additional information from Vend about the sale, payment and
// line items. This is often used to obtain the register_id that processed the
// transaction, as it is the best unique identifier to pair a terminal with.
// This means that if the gateway is storing pairings between a register and a
// terminal, then there is a way to route the payment correctly.
function dataStep() {
    console.log('sending DATA step')
    sendObjectToVendForFiscalPrint({
        step: 'DATA'
    })
}

// DECLINE: Return to pay screen and if enabled a declined transaction receipt
// will also print, including the receipt_html_extra specified. It is important
// to print at this stage to make sure terminal output is included on the
// receipt.
function declineStep(receiptHTML) {
    console.log('sending DECLINE step')
    sendObjectToVend({
        step: 'DECLINE',
        print: true,
        receipt_html_extra: receiptHTML
    })
}

// EXIT: Cleanly exit the process. Does not close the window but closes all
// other dialogs including the payment modal/iFrame and unbinds postMessage
// handling. It is better to avoid using this step, as it breaks the transaction
// flow prematurely, and so should only be sent if we are absolutely sure that
// we know the transaction outcome.
function exitStep() {
    console.log('sending EXIT step')
    sendObjectToVend({
        step: 'EXIT'
    })
}

// PRINT: Manually trigger a receipt, including any extra information specified.
// This step is not often needed as ACCEPT and DECLINE both include receipt
// printing. It can however be used to print a signature slip midway through
// processing if signature is required by the card verifiction method, in this
// case receipt_html_extra would be used to print a signature line.
function printStep(receiptHTML) {
    console.log('sending PRINT step')
    sendObjectToVend({
        step: 'PRINT',
        receipt_html_extra: receiptHTML
    })
}
// added to print fiscal invoice from FRCS
function printFiscalInvoice(receiptHTML,QrCode) {
    console.log('sending PRINT step');


    sendObjectToVend({
        step: 'PRINT',
        receipt_html_extra: "<h2><pre>" + receiptHTML.split("======== END OF FISCAL INVOICE =========")[0] + '<img src="' + QrCode + '"/>' + "======== END OF FISCAL INVOICE =========" +"</pre></h2>"
    })
}
// SETUP: Customize the payment dialog. At this stage removing close button to
// prevent cashiers from prematurely closing the modal is advised, as it leads
// to interrupted payment flow without a clean exit.
function setupStep() {
    console.log('sending SETUP step')
    sendObjectToVend({
        step: 'SETUP',
        setup: {
            enable_close: false
        }
    })
}


function GetAccessToken()
{
    var settings = {
        "async": false,
        "crossDomain": true,
        "url": "https://venddevelopment.vendhq.com/api/1.0/token",
        "method": "POST",
        "headers": {
            "content-type": "application/x-www-form-urlencoded",
        },
        "data": {
            "refresh_token": "xXwyWBeUZX0hndhEf5kiYM7iVt24KG0wqoZGLvng",
            "client_id": "z3MIYzmTQCm0euaQZjRL86PwZFnDAwGV",
            "client_secret": "Af6Lr1JpuYkqJD9eRdwLZIXtYwe4VQcB",
            "grant_type": "refresh_token"
        }
    }
    $.ajax(settings).done(function (response) {
        return response.access_token;
    });

  
}

// Get query parameters from the URL. Vend includes amount, origin, and
// register_id.
function getURLParameters() {
    var pageURL = decodeURIComponent(window.location.search.substring(1)),
        params = pageURL.split('&'),
        paramName,
        parameters = {}

    params.forEach(function (param) {
        paramName = param.split('=')

        console.log(paramName)

        switch (paramName[0]) {
            case 'amount':
                parameters.amount = paramName[1]
                break
            case 'origin':
                parameters.origin = paramName[1]
                break
            case 'register_id':
                parameters.register_id = paramName[1]
                break
        }
    })

    console.log(parameters)

    return parameters
}

// Check response status from the gateway, we then manipulate the payment flow
// in Vend in response to this using the Payment API steps.
function checkResponse(response) {
    switch (response.status) {
        case 'ACCEPTED':
            $('#statusMessage').empty()

            acceptStep('<div>ACCEPTED</div>', response.id)
            break
        case 'DECLINED':
            $('#statusMessage').empty()
            $.get('../assets/templates/declined.html', function (data) {
                $('#statusMessage').append(data)
            })

            setTimeout(declineStep, 4000, '<div>DECLINED</div>')
            break
        case 'FAILED':
            $('#statusMessage').empty()
            $.get('../assets/templates/failed.html', function (data) {
                $('#statusMessage').append(data)
            })

            setTimeout($('#outcomes').show(), 6000)
            break
        case 'TIMEOUT':
            $('#statusMessage').empty()
            $.get('../assets/templates/timeout.html', function (data) {
                $('#statusMessage').append(data)
            })

            setTimeout(declineStep, 4000, '<div>CANCELLED</div>')
            break
        case 'UNKNOWN':
            $('#statusMessage').empty()
            $.get('../assets/templates/failed.html', function (data) {
                $('#statusMessage').append(data)
            })

            setTimeout($('#outcomes').show(), 4000)
            break
        default:
            $('#statusMessage').empty()
            $.get('../assets/templates/failed.html', function (data) {
                $('#statusMessage').append(data)
            })

            // Do not know what we got, or something went wrong, so log it.
            console.log(response)
            setTimeout($('#outcomes').show(), 4000)
            break
    }
}


//function same as sendPayment()

function AddItemsForSignInvoice() {

    // Get the payment context from the URL query string.
    var result = {}
    result = getURLParameters()
    // If we did not at least two query params from Vend something is wrong.
    if (Object.keys(result).length < 2) {
        console.log('did not get at least two query results')
        $('#statusMessage').empty()
        $.get('../assets/templates/failed.html', function (data) {
            $('#statusMessage').append(data)
        })
        setTimeout(exitStep(), 4000)
    }
    var data = {}

}

// sendPayment sends payment context to the gateway to begin processing the
// payment.
function sendPayment(outcome) {
    // Hide outcome buttons.
    $('#outcomes').hide()

    console.log('sending payment')

    // Show tap insert or swipe card prompt.
    $('#statusMessage').empty()
    $.get('../assets/templates/payment.html', function (data) {
        $('#statusMessage').append(data)
    })

    // Get the payment context from the URL query string.
    var result = {}
    result = getURLParameters()

    // If we did not at least two query params from Vend something is wrong.
    if (Object.keys(result).length < 2) {
        console.log('did not get at least two query results')
        $('#statusMessage').empty()
        $.get('../assets/templates/failed.html', function (data) {
            $('#statusMessage').append(data)
        })
        setTimeout(exitStep(), 4000)
    }

    // Request /pay endpoint to send amount to terminal and wait for respnse.
    $.ajax({
        url: 'pay',
        type: 'GET',
        dataType: 'json',
        data: {
            amount: result.amount,
            outcome: outcome,
            origin: result.origin,
            register_id: result.register_id
        }
    })
        .done(function (response) {
            console.log(response)

            // Hide outcome buttons while we handle the response.
            $('#outcomes').hide()

            // Check the response body and act according to the payment status.
            checkResponse(response)
        })
        .fail(function (error) {
            console.log(error)

            // Make sure status text is cleared.
            $('#outcomes').hide()
            $('#statusMessage').empty()
            $.get('../assets/templates/failed.html', function (data) {
                $('#statusMessage').append(data)
            })
            // Quit window, giving cashier chance to try again.
            setTimeout(declineStep, 4000)
        })
}

// cancelPayment simulates cancelling a payment.
function cancelPayment(outcome) {
    console.log('cancelling payment')

    // Hide outcome buttons.
    $('#outcomes').hide()

    // Show the cancelling with a loader.
    $('#statusMessage').empty()
    $.get('../assets/templates/cancelling.html', function (data) {
        $('#statusMessage').append(data)
    })

    // Wait four seconds, then quit window, giving the cashier a chance to try
    // again.
    setTimeout(declineStep, 4000, '<div>CANCELLED</div>')
}
var product = [];
var productData;




// Listen for postMessage events from Vend, if requesting extra sale data then
// this is where you can handle the sale JSON.
window.addEventListener(
    'message',
    function (event) {
        console.log('received event from Vend')

        var data
        data = JSON.parse(event.data)
        if (data.step == "DATA") {
            if (data.success == true) {
                productData = data;
                var product = [];
                var access_token = GetAccessToken();
                for (var i = 1; i <= data.register_sale.line_items.length; i++) {
                    console.log(data.register_sale.line_items.length);
                    var items = data.register_sale.line_items[i - 1];
                    console.log(items);
                    console.log("changed");

                    var settings = {
                        "async": false,
                        "crossDomain": true,
                        "url": "https://venddevelopment.vendhq.com/api/products/" + items.product_id,
                        "method": "GET",
                        "headers": {
                            "authorization": "Bearer " + access_token,
                        }
                    }
                    $.ajax(settings).done(function (response) {
                        var productitem =
                        {
                            "Name": response["products"][0]["name"],
                            "Quantity": items.quantity,
                            "Labels": [
                                "A"
                            ],
                            "TotalAmount": parseFloat(items.unit_price) * parseFloat(items.quantity)
                        }
                        product.push(productitem);
                        console.log(productitem);
                        
                    });                   

                }
                var invoiceRequest = {
                    "DateAndTimeOfIssue": "2019-06-29T05:14:10.286Z",
                    "Cashier": "Marie",
                    "BD": 8902798054,
                    "IT": "Normal",
                    "TT": "Sale",
                    "PaymentType": "Cash",
                    "PAC": "YQS4AR",
                    "Options": {
                        "OmitTextualRepresentation": 0,
                        "OmitQRCodeGen": 0
                    },
                };
                invoiceRequest["Items"] = product;
                console.log(invoiceRequest);
                document.getElementById("invoiceRequest").innerHTML = JSON.stringify(invoiceRequest);
            }
        }
    },
    false
)

function showClose() {
    sendObjectToVend({
        step: 'SETUP',
        setup: {
            enable_close: true
        }
    })
}

function seeForm() {
    // Since we cannot navigate away from this screen and it does not close
    // automatically, show the close modal button.
    showClose();

    // Hide outcome buttons.
    $('#outcomes').hide()

    // Show the cancelling with a loader.
    $('#statusMessage').empty()
    $.get('../assets/templates/forms.html', function (data) {
        $('#statusMessage').append(data)
    });

}

window.onmessage = function (e) {
    console.log(e.data);
}
function CreateExampleInvoiceRequest() {
    var invoiceRequest = {
        "DateAndTimeOfIssue": "2019-06-29T05:14:10.286Z",
        "Cashier": "Marie",
        "BD": 8902798054,
        "IT": "Normal",
        "TT": "Sale",
        "PaymentType": "Cash",
        "InvoiceNumber": "F58BZUBG-T5UX48AJ-a1",
        "PAC": "YQS4AR",
        "Options": {
            "OmitTextualRepresentation": 0,
            "OmitQRCodeGen": 0
        },
        "Items": [
            {
                "Name": "Moon Mug",
                "Quantity": 1,
                "Labels": [
                    "A"
                ],
                "TotalAmount": 25.90
            }
        ]
    };
    return invoiceRequest;
}
// On initial load of modal, configure the page settings such as removing the
// close button and setting the header.
$(function () {
    // Send the SETUP step with our configuration values..
    console.log('setting up')
    setupStep()

    $('#statusMessage').empty()
    $.get('../assets/templates/waiting.html', function (data) {
        $('#statusMessage').append(data)
    })

    // Show outcome buttons.
    $('#outcomes').show()
})