// This is a Thunderbird WebExtension API script for adding a right-click option to open attachments in QubesOS Disposable VMs.

let currentMessageId = null;

browser.runtime.onInstalled.addListener(() => {
    console.log("QubesOS DVM Attachment Opener installed.");
});

browser.messageDisplay.onMessagesDisplayed.addListener((tab, displayedMessages) => {
    if (displayedMessages.length > 0) {
        currentMessageId = displayedMessages[0].id;
        console.log("Currently displayed messageId:", currentMessageId);
    } else {
        currentMessageId = null;
        console.log("No message is currently displayed.");
    }
});

browser.menus.create({
    id: "open-in-dvm",
    title: "Open in Qubes Disposable VM",
    contexts: ["message_attachments"]
});

browser.menus.onClicked.addListener(async (info, tab) => {
    try {
        console.log("Menu item clicked:", info);

        if (info.menuItemId === "open-in-dvm") {
            const attachments = info.attachments;
            if (!attachments || attachments.length === 0) {
                console.error("No attachments found in the context menu.");
                return;
            }

            const attachment = attachments[0]; // Use the first attachment
            console.log("Selected attachment:", attachment);

            const partName = attachment.partName;

            if (!currentMessageId) {
                console.error("No current messageId is available. Unable to proceed.");
                return;
            }

            console.log("Attachment partName:", partName, "Message ID:", currentMessageId);

            if (partName && currentMessageId) {
                const attachmentFile = await browser.messages.getAttachmentFile(currentMessageId, partName);
                console.log("Attachment retrieved:", attachmentFile);

                // Save the attachment to a temporary location.
                const tempFilePath = await saveAttachmentLocally(attachmentFile, attachment.name);
                console.log("Attachment saved to temporary path:", tempFilePath);

                // Execute the Qubes DVM open command.
                const commandOutput = await executeCommandInDVMWithDebug(tempFilePath);
                console.log("Command output:", commandOutput);
            } else {
                console.error("Missing partName or message ID.");
            }
        }
    } catch (error) {
        console.error("Error in menu click handler:", error);
    }
});

async function saveAttachmentLocally(blob, filename) {
    try {
        console.log("Saving attachment locally with filename:", filename);

        const fileBlob = new Blob([blob], { type: blob.type });
        const fileUrl = URL.createObjectURL(fileBlob);

        const downloadId = await browser.downloads.download({
            url: fileUrl,
            filename: filename,
            saveAs: false
        });

        const downloadItem = await browser.downloads.search({ id: downloadId });
        console.log("Downloaded file path:", downloadItem[0].filename);

        return downloadItem[0].filename;
    } catch (error) {
        console.error("Error saving attachment locally:", error);
        throw error;
    }
}

async function executeCommandInDVMWithDebug(filePath) {
    try {
        console.log("Executing command in Qubes DVM for file:", filePath);
        return new Promise((resolve, reject) => {
            browser.runtime.sendNativeMessage("qubes_dvm_opener", { // Updated application name
                command: "/usr/bin/qvm-open-in-dvm",
                args: [filePath]
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Error executing command:", chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else {
                    console.log("Command executed successfully:", response);
                    resolve(response);
                }
            });
        });
    } catch (error) {
        console.error("Error in executeCommandInDVMWithDebug:", error);
        throw error;
    }
}

// Helper for QubesOS syntax adaptation (from older project inspiration)
function qubesExecuteCommand(filePath) {
    const process = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
    const qubesCommand = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);

    qubesCommand.initWithPath("/usr/bin/qvm-open-in-dvm");
    process.init(qubesCommand);
    process.run(false, [filePath], 1);
}
