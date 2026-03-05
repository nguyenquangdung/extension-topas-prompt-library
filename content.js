console.log("Topas Quick Search PRO v10 (Omega) loaded")

let cachedPrompts = []
let filteredPrompts = []
let selectedIndex = 0
let lastQuery = ""
let lastActiveElement = null

// popup injection
const popup = document.createElement("div")
popup.id = "topas-suggestion-container"
document.body.appendChild(popup)

// Ensure popup stays in DOM against framework refreshes
const observer = new MutationObserver(() => {
    if (!popup.isConnected) {
        document.body.appendChild(popup)
    }
})
observer.observe(document.body, { childList: true, subtree: true })

// Load prompt cache from local storage
function updateCache() {
    chrome.storage.local.get(["cachedPrompts"], res => {
        cachedPrompts = res.cachedPrompts || []
    })
}
updateCache()
chrome.storage.onChanged.addListener(changes => {
    if (changes.cachedPrompts) {
        cachedPrompts = changes.cachedPrompts.newValue || []
    }
})

// Global event listeners
document.addEventListener("input", handleGlobalEvent, true)
document.addEventListener("keyup", handleGlobalEvent, true)
document.addEventListener("keydown", handleKeyDown, true)
document.addEventListener("mousedown", e => {
    if (!popup.contains(e.target)) {
        hidePopup()
    }
}, true)

function handleGlobalEvent(e) {
    const ignore = ["ArrowUp", "ArrowDown", "Enter", "Escape", "Tab"]
    if (e.type === "keyup" && ignore.includes(e.key)) return

    let el = e.composedPath()[0] || document.activeElement
    el = findEditor(el)

    if (el) handleInput(el)
}

function findEditor(el) {
    if (!el) return null
    let node = el
    while (node && node !== document.body) {
        if (
            node.tagName === "TEXTAREA" ||
            node.tagName === "INPUT" ||
            node.isContentEditable ||
            node.getAttribute?.("role") === "textbox" ||
            node.getAttribute?.("role") === "combobox"
        ) {
            return node
        }
        node = node.parentElement
    }
    return null
}

function handleInput(el) {
    if (!isSupportedInput(el)) {
        hidePopup()
        return
    }

    const text = getInputValue(el)
    const pos = getSelectionOffset(el)
    const textBeforeCursor = text.substring(0, pos)
    const match = textBeforeCursor.match(/(\?)([a-zA-Z0-9 ]*)$/)

    if (match) {
        const query = match[2].toLowerCase()
        lastActiveElement = el

        if (query !== lastQuery) {
            selectedIndex = 0
            lastQuery = query
        }
        showSuggestions(query)
    } else {
        hidePopup()
    }
}

function getSelectionOffset(el) {
    try {
        if (el.isContentEditable) {
            const sel = window.getSelection()
            if (!sel || !sel.rangeCount) return 0
            const range = sel.getRangeAt(0)
            const preCaretRange = range.cloneRange()
            preCaretRange.selectNodeContents(el)
            preCaretRange.setEnd(range.endContainer, range.endOffset)
            return preCaretRange.toString().length
        }
        return el.selectionEnd
    } catch (e) {
        return 0
    }
}

function showSuggestions(query) {
    filteredPrompts = cachedPrompts.filter(p =>
        (p.title && p.title.toLowerCase().includes(query)) ||
        (p.content && p.content.toLowerCase().includes(query))
    ).slice(0, 10)

    if (!filteredPrompts.length) {
        hidePopup()
        return
    }

    renderList()
    popup.style.display = "block"
    positionPopup()
}

function renderList() {
    popup.innerHTML = filteredPrompts.map((p, i) => `
        <div class="topas-suggestion-item ${i === selectedIndex ? "selected" : ""}" data-index="${i}">
            <div class="topas-item-title">${escapeHtml(p.title)}</div>
            <div class="topas-item-preview">${escapeHtml(p.content || "").substring(0, 100)}...</div>
        </div>
    `).join("")

    popup.querySelectorAll(".topas-suggestion-item").forEach((el, i) => {
        el.onmousedown = e => {
            e.preventDefault()
            insertPrompt(filteredPrompts[i])
        }
    })
}

function handleKeyDown(e) {
    if (popup.style.display !== "block") return

    if (e.key === "ArrowDown") {
        e.preventDefault()
        e.stopImmediatePropagation()
        selectedIndex = (selectedIndex + 1) % filteredPrompts.length
        renderList()
    } else if (e.key === "ArrowUp") {
        e.preventDefault()
        e.stopImmediatePropagation()
        selectedIndex = (selectedIndex - 1 + filteredPrompts.length) % filteredPrompts.length
        renderList()
    } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        e.stopImmediatePropagation()
        insertPrompt(filteredPrompts[selectedIndex])
    } else if (e.key === "Escape") {
        e.preventDefault()
        e.stopImmediatePropagation()
        hidePopup()
    }
}

function insertPrompt(prompt) {
    if (!lastActiveElement) return

    const text = prompt.content || ""
    const el = lastActiveElement
    el.focus()

    // 1. DELETE TRIGGER (?abc)
    const val = getInputValue(el)
    const pos = getSelectionOffset(el)
    const textBeforeCursor = val.substring(0, pos)
    const match = textBeforeCursor.match(/(\?)([a-zA-Z0-9 ]*)$/)

    if (match) {
        const len = match[0].length
        if (el.isContentEditable) {
            const sel = window.getSelection()
            // Extend selection backward to cover the trigger
            for (let i = 0; i < len; i++) {
                sel.modify("extend", "backward", "character")
            }
            document.execCommand("delete")
        } else {
            const start = el.selectionStart - len
            const end = el.selectionEnd
            el.setSelectionRange(start, end)
            document.execCommand("delete")
        }
    }

    let inserted = false

    // =========================
    // =========================
    // STRATEGY 1 — Clipboard Paste
    // Best for Gemini / Flow
    // =========================

    try {

        const before = getInputValue(el)

        const dt = new DataTransfer()
        dt.setData("text/plain", text)

        const pasteEvent = new ClipboardEvent("paste", {
            clipboardData: dt,
            bubbles: true,
            cancelable: true
        })

        el.dispatchEvent(pasteEvent)

        const after = getInputValue(el)

        if (after !== before) {
            inserted = true
        }

    } catch (e) { }


    // =========================
    // STRATEGY 2 — execCommand
    // Best for Claude / Notion
    // =========================
    if (!inserted) {
        try {
            inserted = document.execCommand("insertText", false, text)
        } catch (e) { }
    }


    // =========================
    // STRATEGY 3 — Range API
    // Best for ChatGPT / Grok
    // =========================
    if (!inserted && el.isContentEditable) {
        try {
            const sel = window.getSelection()
            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0)
                range.deleteContents()

                const node = document.createTextNode(text)
                range.insertNode(node)

                range.setStartAfter(node)
                range.setEndAfter(node)

                sel.removeAllRanges()
                sel.addRange(range)

                el.dispatchEvent(new InputEvent("input", {
                    bubbles: true,
                    inputType: "insertText",
                    data: text
                }))

                el.dispatchEvent(new Event("change", { bubbles: true }))

                inserted = true
            }
        } catch (e) { }
    }


    // =========================
    // STRATEGY 4 — Native Setter
    // Fallback for textarea / input
    // =========================
    if (!inserted && el.value !== undefined) {
        const nativeSetter =
            Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set ||
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set

        if (nativeSetter) {
            nativeSetter.call(el, text)
        } else {
            el.value = text
        }

        el.dispatchEvent(new Event("input", { bubbles: true }))
        inserted = true
    }

    hidePopup()
}

function hidePopup() {
    popup.style.display = "none"
    lastQuery = ""
    selectedIndex = 0
}

function isSupportedInput(el) {
    if (!el) return false
    const tag = el.tagName
    const role = el.getAttribute?.("role")
    const ce = el.getAttribute?.("contenteditable")

    return tag === "TEXTAREA" ||
        (tag === "INPUT" && (el.type === "text" || el.type === "search" || el.type === "email")) ||
        el.isContentEditable ||
        (ce && ce !== "false") ||
        role === "textbox" ||
        role === "combobox"
}

function getInputValue(el) {
    if (el.isContentEditable) return el.innerText
    return el.value || ""
}

function positionPopup() {
    const rect = getCaretCoordinates()
    let top = rect.bottom + window.scrollY + 8
    let left = rect.left + window.scrollX

    const popupWidth = popup.offsetWidth || 320
    const popupHeight = popup.offsetHeight || 320

    if (left + popupWidth > window.innerWidth + window.scrollX) {
        left = window.innerWidth + window.scrollX - popupWidth - 16
    }
    if (left < 16) left = 16

    if (top + popupHeight > window.innerHeight + window.scrollY) {
        top = rect.top + window.scrollY - popupHeight - 8
    }

    popup.style.top = top + "px"
    popup.style.left = left + "px"
}

function getCaretCoordinates() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0).cloneRange()
        const rects = range.getClientRects()
        if (rects.length > 0) return rects[0]
        const rect = range.getBoundingClientRect()
        if (rect.width || rect.height) return rect
    }
    if (lastActiveElement) {
        return lastActiveElement.getBoundingClientRect()
    }
    return { top: 0, left: 0, bottom: 0, right: 0 }
}

function escapeHtml(text) {
    if (!text) return ""
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
}