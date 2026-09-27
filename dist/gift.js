/*
 * Wedding Gift configuration.
 * This is the only place where payment and shipping details are maintained.
 * Add another object to accounts when an additional bank account is needed.
 */
const weddingGiftConfig = Object.freeze({
    enabled: true,
    accounts: [
        {
            bankName: "BCA",
            accountNumber: "2831927471",
            accountHolder: "Puteri Nea Marisa Dewi"
        },
        {
            bankName: "BSI",
            accountNumber: "1049200443",
            accountHolder: "Ilham Nurzaman"
        }
    ],
    giftDelivery: {
        recipientName: "Ilham Nurzaman",
        shippingAddress: "Jl. Kp. Pamoyanan RT 07/RW 02, Desa Panenjoan, Kec. Cicalengka, Kabupaten Bandung"
    }
});

document.addEventListener("DOMContentLoaded", function () {
    initWeddingGift(weddingGiftConfig);
});

function initWeddingGift(config) {
    const section = document.querySelector(".world-shot--gift-configured");
    if (!section) return;

    const hasText = function (value) {
        return typeof value === "string" && value.trim().length > 0;
    };
    const accountsAreConfigured = Array.isArray(config && config.accounts) && config.accounts.length > 0 &&
        config.accounts.every(function (account) {
            return account && hasText(account.bankName) && hasText(account.accountNumber) && hasText(account.accountHolder);
        });
    const deliveryIsConfigured = Boolean(config && config.giftDelivery) &&
        hasText(config.giftDelivery.recipientName) && hasText(config.giftDelivery.shippingAddress);
    const isConfigured = Boolean(config && config.enabled && accountsAreConfigured && deliveryIsConfigured);

    section.hidden = !isConfigured;
    section.classList.toggle("is-unconfigured", !isConfigured);
    section.dataset.giftState = isConfigured ? "configured" : "unconfigured";
    if (!isConfigured || section.dataset.giftInitialized === "true") return;

    section.dataset.giftInitialized = "true";

    const envelope = section.querySelector("[data-gift-envelope]");
    const letter = document.getElementById("giftLetter");
    const openButton = section.querySelector("[data-gift-open]");
    const choiceButtons = Array.from(section.querySelectorAll("[data-gift-choice]"));
    const transferPanel = document.getElementById("giftTransferPanel");
    const shippingPanel = document.getElementById("giftShippingPanel");
    const accountList = section.querySelector("[data-gift-account-list]");
    const addressToggle = section.querySelector("[data-gift-address-toggle]");
    const addressDetails = document.getElementById("giftAddressDetails");
    const feedback = section.querySelector("[data-gift-feedback]");
    let feedbackTimer = null;

    const setContent = function (selector, value) {
        const target = section.querySelector(selector);
        if (target) target.textContent = value.trim();
    };

    config.accounts.forEach(function (account, index) {
        const sheet = document.createElement("div");
        const bank = document.createElement("h3");
        const number = document.createElement("p");
        const holder = document.createElement("p");
        const holderName = document.createElement("span");
        const copyButton = document.createElement("button");

        sheet.className = "gift-account-sheet";
        sheet.dataset.accountIndex = String(index);
        bank.className = "gift-bank";
        number.className = "gift-account-number";
        holder.className = "gift-account-holder";
        copyButton.className = "gift-action";
        copyButton.type = "button";
        copyButton.dataset.giftCopyAccount = String(index);
        copyButton.setAttribute("aria-label", "Salin nomor rekening " + account.bankName.trim());

        bank.textContent = account.bankName.trim();
        number.textContent = account.accountNumber.trim();
        holder.append("a.n. ", holderName);
        holderName.textContent = account.accountHolder.trim();
        copyButton.textContent = "Salin Nomor Rekening";
        sheet.append(bank, number, holder, copyButton);
        accountList.appendChild(sheet);
    });

    setContent("[data-gift-recipient-name]", config.giftDelivery.recipientName);
    setContent(
        "[data-gift-shipping-address]",
        config.giftDelivery.shippingAddress.replace(/,\s*/g, ",\n").replace(/\s+\(/g, "\n(")
    );

    const announce = function (message) {
        window.clearTimeout(feedbackTimer);
        feedback.textContent = "";
        window.requestAnimationFrame(function () {
            feedback.textContent = message;
        });
        feedbackTimer = window.setTimeout(function () {
            feedback.textContent = "";
        }, 3200);
    };

    const copyText = async function (text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const temporaryInput = document.createElement("textarea");
        temporaryInput.value = text;
        temporaryInput.setAttribute("readonly", "");
        temporaryInput.style.position = "fixed";
        temporaryInput.style.opacity = "0";
        document.body.appendChild(temporaryInput);
        temporaryInput.select();
        const copied = document.execCommand("copy");
        temporaryInput.remove();
        if (!copied) throw new Error("Clipboard unavailable");
    };

    const closePanels = function () {
        transferPanel.hidden = true;
        shippingPanel.hidden = true;
        addressDetails.hidden = true;
        addressToggle.setAttribute("aria-expanded", "false");
        addressToggle.textContent = "Lihat Alamat Pengiriman";
        choiceButtons.forEach(function (button) {
            button.setAttribute("aria-expanded", "false");
            button.classList.remove("is-selected");
        });
    };

    const showPanel = function (name) {
        const showTransfer = name === "transfer";
        transferPanel.hidden = !showTransfer;
        shippingPanel.hidden = showTransfer;
        choiceButtons.forEach(function (button) {
            const selected = button.dataset.giftChoice === name;
            button.setAttribute("aria-expanded", String(selected));
            button.classList.toggle("is-selected", selected);
        });
    };

    openButton.addEventListener("click", function () {
        const isOpen = envelope.classList.toggle("is-open");
        document.body.classList.toggle("gift-envelope-open", isOpen);
        openButton.setAttribute("aria-expanded", String(isOpen));
        openButton.textContent = isOpen ? "Tutup Amplop" : "Buka Amplop";
        letter.setAttribute("aria-hidden", String(!isOpen));
        if (!isOpen) closePanels();
    });

    choiceButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            showPanel(button.dataset.giftChoice);
        });
    });

    addressToggle.addEventListener("click", function () {
        const isExpanded = addressToggle.getAttribute("aria-expanded") === "true";
        addressToggle.setAttribute("aria-expanded", String(!isExpanded));
        addressToggle.textContent = isExpanded ? "Lihat Alamat Pengiriman" : "Sembunyikan Alamat Pengiriman";
        addressDetails.hidden = isExpanded;
    });

    section.querySelectorAll("[data-gift-copy-account]").forEach(function (button) {
        button.addEventListener("click", async function () {
            const account = config.accounts[Number(button.dataset.giftCopyAccount)];
            try {
                await copyText(account.accountNumber.trim());
                announce("Nomor rekening " + account.bankName.trim() + " berhasil disalin");
            } catch {
                announce("Nomor rekening " + account.bankName.trim() + " belum dapat disalin");
            }
        });
    });

    section.querySelector("[data-gift-copy-address]").addEventListener("click", async function () {
        try {
            await copyText(config.giftDelivery.shippingAddress.trim());
            announce("Alamat pengiriman berhasil disalin");
        } catch {
            announce("Alamat belum dapat disalin");
        }
    });
}
