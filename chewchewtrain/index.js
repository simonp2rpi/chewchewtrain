function previewOrder() {
    let order = document.getElementById("order");
    let hidden = order.getAttribute("hidden");
    if (hidden || hidden == '') {
        order.removeAttribute("hidden");
    } else {
        order.setAttribute("hidden", "hidden");
    }
}

function showPay() {
    document.getElementById("payModal").style.display="block";
}

function closePay() {
    document.getElementById("payModal").style.display="none";
}

function togglePay() {
    let state = document.getElementById("payModal").style
}

// let cart = {
//     "pad thai": 0
// }
