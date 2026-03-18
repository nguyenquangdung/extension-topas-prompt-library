// --- Config ---
console.log("App.js loading...");
const SUPABASE_URL = 'https://yhrxfnjpgurchgzvjtqw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlocnhmbmpwZ3VyY2hnenZqdHF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1OTU4MjQsImV4cCI6MjA4ODE3MTgyNH0.ig6y9DCHNX-nyN3Rt48Dp7FGA-ZpAqMkFjSmzsAKREw';

// --- Custom Modals ---
function customAlert(message) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '9999';
    
    const card = document.createElement('div');
    card.className = 'modal-card';
    card.style.maxWidth = '300px';
    card.style.textAlign = 'center';
    card.style.padding = '20px';
    
    const text = document.createElement('div');
    text.style.marginBottom = '16px';
    text.style.fontSize = '14px';
    text.style.color = 'var(--slate-800)';
    text.textContent = message;
    
    const btn = document.createElement('button');
    btn.className = 'btn-copy';
    btn.style.margin = '0';
    btn.style.width = '100%';
    btn.textContent = 'OK';
    btn.onclick = () => overlay.remove();
    
    card.appendChild(text);
    card.appendChild(btn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
}

function customConfirm(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.zIndex = '9999';
        
        const card = document.createElement('div');
        card.className = 'modal-card';
        card.style.maxWidth = '300px';
        card.style.textAlign = 'center';
        card.style.padding = '20px';
        
        const text = document.createElement('div');
        text.style.marginBottom = '16px';
        text.style.fontSize = '14px';
        text.style.color = 'var(--slate-800)';
        text.textContent = message;
        
        const btnGroup = document.createElement('div');
        btnGroup.style.display = 'flex';
        btnGroup.style.gap = '8px';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-icon';
        cancelBtn.style.flex = '1';
        cancelBtn.style.border = '1px solid var(--slate-200)';
        cancelBtn.style.borderRadius = '8px';
        cancelBtn.style.justifyContent = 'center';
        cancelBtn.textContent = 'Hủy';
        cancelBtn.onclick = () => { overlay.remove(); resolve(false); };
        
        const okBtn = document.createElement('button');
        okBtn.className = 'btn-copy';
        okBtn.style.margin = '0';
        okBtn.style.flex = '1';
        okBtn.style.background = 'var(--rose-500)';
        okBtn.textContent = 'Xóa';
        okBtn.onclick = () => { overlay.remove(); resolve(true); };
        
        btnGroup.appendChild(cancelBtn);
        btnGroup.appendChild(okBtn);
        card.appendChild(text);
        card.appendChild(btnGroup);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
    });
}

let supabaseClient;
try {
    console.log("Creating Supabase client...");
    if (!window.supabase) {
        throw new Error("Supabase library not found on window object. Check if lib/supabase-lib.js is loaded correctly.");
    }
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase client created.");
} catch (e) {
    console.error("Supabase creation failed:", e);
    customAlert("Lỗi khởi tạo Supabase: " + e.message);
}

// --- State ---
const state = {
    user: null,
    userRoles: [],
    isSuperAdmin: false,
    markets: [],
    topics: [],
    prompts: [],
    pinnedIds: [],
    selectedMarketId: null,
    selectedTopicId: null,
    searchQuery: '',
};

// --- DOM Elements ---
const screens = {
    login: document.getElementById('login-screen'),
    app: document.getElementById('app-screen'),
    detail: document.getElementById('detail-overlay'),
    settings: document.getElementById('settings-screen')
};

const components = {
    marketSelect: document.getElementById('select-market'),
    topicSelect: document.getElementById('select-topic'),
    promptList: document.getElementById('prompt-list'),
    pinnedList: document.getElementById('pinned-list'),
    searchInput: document.getElementById('input-search'),
    detailTitle: document.getElementById('detail-title'),
    detailContent: document.getElementById('detail-content'),
    triggerInput: document.getElementById('input-trigger-char'),
    navHome: document.querySelectorAll('#nav-home, #nav-home-settings'),
    navWebsite: document.querySelectorAll('#nav-website, #nav-website-settings'),
    navSettings: document.querySelectorAll('#nav-settings, #nav-settings-settings'),
};

// --- Initialization ---
async function init() {
    console.group("Topas App Initialization");
    try {
        // Load pinned IDs and settings from storage
        chrome.storage.local.get(['pinnedIds', 'triggerChar'], (result) => {
            state.pinnedIds = result.pinnedIds || [];
            if (result.triggerChar) {
                components.triggerInput.value = result.triggerChar;
            } else {
                components.triggerInput.value = '?';
                chrome.storage.local.set({ triggerChar: '?' });
            }
        });

        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (session) {
            handleLogin(session.user);
        } else {
            showScreen('login');
        }

        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (session) {
                handleLogin(session.user);
            } else {
                showScreen('login');
            }
        });

        // Check for updates
        checkForUpdates();
    } catch (err) {
        console.error("Critical error during init:", err);
    } finally {
        console.groupEnd();
    }
}

async function checkForUpdates() {
    try {
        const manifestRes = await fetch(chrome.runtime.getURL("manifest.json"));
        const manifest = await manifestRes.json();
        const currentVersion = manifest.version;

        // Delegate the GitHub API call to background.js to bypass CSP
        chrome.runtime.sendMessage({ action: 'checkForUpdates' }, (response) => {
            if (!response || !response.success) {
                showUpdateBanner('up-to-date', currentVersion);
                return;
            }

            const latestVersion = response.latestVersion;
            if (latestVersion && currentVersion) {
                if (latestVersion.localeCompare(currentVersion, undefined, { numeric: true, sensitivity: 'base' }) > 0) {
                    showUpdateBanner('outdated', currentVersion, latestVersion, response.zipball_url, response.html_url);
                } else {
                    showUpdateBanner('up-to-date', currentVersion);
                }
            }
        });
    } catch (e) {
        console.log("Failed to check for updates:", e);
    }
}

function showUpdateBanner(status, currentVersion, latestVersion, zipUrl, releaseUrl) {
    if (document.getElementById('update-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'update-banner';

    if (status === 'outdated') {
        banner.classList.add('update-outdated');
        banner.innerHTML = `
            <div class="update-text">⚠️ Có bản mới v${latestVersion}! (Hiện tại: v${currentVersion})</div>
            <button class="btn-update btn-update-download" id="btn-download-update">Tải Về</button>
        `;
        // Insert banner
        const filtersContainer = screens.app.querySelector('.filters-container');
        if (filtersContainer) {
            screens.app.insertBefore(banner, filtersContainer);
        }
        document.getElementById('btn-download-update').onclick = () => {
            window.open(zipUrl || releaseUrl, '_blank');
        };
    } else {
        banner.classList.add('update-latest');
        banner.innerHTML = `
            <div class="update-text">✅ Đây là bản mới nhất (v${currentVersion})</div>
        `;
        const filtersContainer = screens.app.querySelector('.filters-container');
        if (filtersContainer) {
            screens.app.insertBefore(banner, filtersContainer);
        }
    }
}

async function handleLogin(user) {
    state.user = user;
    showScreen('app');
    await loadMarkets();
}

function showScreen(name) {
    Object.keys(screens).forEach(key => {
        screens[key].classList.toggle('hidden', key !== name);
    });
    // Update bottom nav active state
    if (name === 'app' || name === 'settings') {
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.id.includes(name === 'app' ? 'home' : 'settings'));
        });
    }
}

// --- Data Fetching ---
async function loadMarkets() {
    const { data: markets } = await supabaseClient.from('markets').select('*').order('name');
    state.markets = markets || [];

    const { data: roles } = await supabaseClient.from('user_market_roles').select('market_id, role').eq('user_id', state.user.id);
    state.userRoles = roles || [];
    const allowedIds = state.userRoles.map(r => r.market_id);

    const { data: userProfile } = await supabaseClient.from('users').select('is_super_admin').eq('id', state.user.id).single();
    state.isSuperAdmin = userProfile?.is_super_admin || false;

    if (!state.isSuperAdmin) {
        state.markets = state.markets.filter(m => allowedIds.includes(m.id));
    }

    if (state.markets.length > 0) {
        state.selectedMarketId = state.markets[0].id;
        renderMarkets();
        await loadTopics();
    }
}

async function loadTopics() {
    const { data: topics } = await supabaseClient.from('topics').select('*').eq('market_id', state.selectedMarketId).order('name');
    state.topics = topics || [];
    state.selectedTopicId = null;
    renderTopics();
    await loadPrompts();
}

async function loadPrompts() {
    let query = supabaseClient.rpc('search_prompts', {
        p_market_id: state.selectedMarketId,
        p_topic_id: state.selectedTopicId,
        p_search_text: state.searchQuery || null
    });

    const { data: prompts } = await query;
    state.prompts = prompts || [];
    
    // Sort alphabetically by title A-Z
    state.prompts.sort((a, b) => a.title.localeCompare(b.title));

    renderPrompts();

    const { data: allPrompts } = await supabaseClient.from('prompts').select('id, title, content, topic_id');
    if (allPrompts) {
        chrome.storage.local.set({ cachedPrompts: allPrompts });
    }
}

// --- Rendering ---
function renderMarkets() {
    components.marketSelect.innerHTML = state.markets.map(m =>
        `<option value="${m.id}" ${state.selectedMarketId === m.id ? 'selected' : ''}>${m.name}</option>`
    ).join('');
}

function renderTopics() {
    components.topicSelect.innerHTML = `<option value="">All Topics</option>` +
        state.topics.map(t =>
            `<option value="${t.id}" ${state.selectedTopicId === t.id ? 'selected' : ''}>${t.name}</option>`
        ).join('');
}

function renderPrompts() {
    components.promptList.innerHTML = '';
    components.pinnedList.innerHTML = '';

    const pinnedPrompts = state.prompts.filter(p => state.pinnedIds.includes(p.id));
    const otherPrompts = state.prompts.filter(p => !state.pinnedIds.includes(p.id));

    pinnedPrompts.forEach(p => components.pinnedList.appendChild(createPromptCard(p, true)));
    otherPrompts.forEach(p => components.promptList.appendChild(createPromptCard(p, false)));

    document.getElementById('pinned-section').classList.toggle('hidden', pinnedPrompts.length === 0);
    if (window.lucide) lucide.createIcons();

    // Update UI Permissions for Add/Edit/Delete actions based on user roles
    const currentRole = state.userRoles.find(r => r.market_id === state.selectedMarketId)?.role;
    const canEdit = state.isSuperAdmin || currentRole === 'editor' || currentRole === 'manager';

    const addTopicBtn = document.getElementById('btn-add-topic');
    const addPromptBtn = document.getElementById('btn-add-prompt-float');
    const editPromptBtn = document.getElementById('btn-edit-prompt');

    if (addTopicBtn) addTopicBtn.style.display = canEdit ? '' : 'none';
    if (addPromptBtn) addPromptBtn.style.display = canEdit ? '' : 'none';
    if (editPromptBtn) editPromptBtn.style.display = canEdit ? '' : 'none';
    
    document.querySelectorAll('.delete-icon').forEach(el => {
        el.style.display = canEdit ? '' : 'none';
    });
}

function createPromptCard(prompt, isPinned) {
    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.innerHTML = `
    <div class="prompt-title">${escapeHtml(prompt.title)}</div>
    <div class="prompt-preview">${escapeHtml(prompt.content || '')}</div>
    <div class="card-actions">
      <div class="action-icon copy-quick" data-id="${prompt.id}" title="Copy Prompt">
        <i data-lucide="copy" width="14"></i>
      </div>
      <div class="action-icon pin-icon ${isPinned ? 'active' : ''}" data-id="${prompt.id}" title="${isPinned ? 'Unpin' : 'Pin'}">
        <i data-lucide="pin" width="14"></i>
      </div>
      <div class="action-icon delete-icon" data-id="${prompt.id}" title="Delete Prompt">
        <i data-lucide="trash-2" width="14"></i>
      </div>
    </div>
  `;

    card.onclick = async (e) => {
        const pinBtn = e.target.closest('.pin-icon');
        const copyBtn = e.target.closest('.copy-quick');
        const deleteBtn = e.target.closest('.delete-icon');

        if (pinBtn) {
            togglePin(prompt.id);
            return;
        }

        if (deleteBtn) {
            const confirmed = await customConfirm("Bạn có chắc chắn muốn xóa prompt này?");
            if (confirmed) {
                try {
                    const { error } = await supabaseClient.from('prompts').delete().eq('id', prompt.id);
                    if (error) throw error;
                    await loadPrompts(); // Refresh the list
                } catch (err) {
                    console.error("Delete error:", err);
                    customAlert("Lỗi khi xóa prompt: " + err.message);
                }
            }
            return;
        }

        if (copyBtn) {
            navigator.clipboard.writeText(prompt.content || '');
            const originalIcon = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i data-lucide="check" width="14"></i>';
            setTimeout(() => {
                copyBtn.innerHTML = originalIcon;
                if (window.lucide) lucide.createIcons();
            }, 1000);
            return;
        }

        showDetail(prompt);
    };

    return card;
}

// --- Actions ---
function togglePin(id) {
    const index = state.pinnedIds.indexOf(id);
    if (index > -1) state.pinnedIds.splice(index, 1);
    else state.pinnedIds.push(id);

    chrome.storage.local.set({ pinnedIds: state.pinnedIds });
    renderPrompts();
}

function showDetail(prompt) {
    state.currentPrompt = prompt;
    components.detailTitle.textContent = prompt.title;
    components.detailContent.textContent = prompt.content;
    screens.detail.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function attachGlobalEvents() {
    const loginBtn = document.getElementById('btn-login-google');
    if (loginBtn) {
        loginBtn.onclick = async () => {
            try {
                const redirectUrl = chrome.identity.getRedirectURL();
                const { data, error } = await supabaseClient.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: redirectUrl, skipBrowserRedirect: true }
                });

                if (error) throw error;

                chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true }, async (responseUrl) => {
                    const url = new URL(responseUrl);
                    const access_token = url.hash.match(/access_token=([^&]+)/)?.[1];
                    const refresh_token = url.hash.match(/refresh_token=([^&]+)/)?.[1];

                    if (access_token && refresh_token) {
                        await supabaseClient.auth.setSession({ access_token, refresh_token });
                    }
                });
            } catch (err) {
                console.error("Login error:", err);
                customAlert("Lỗi đăng nhập: " + err.message);
            }
        };
    }

    document.getElementById('btn-logout').onclick = () => supabaseClient.auth.signOut();
    document.getElementById('btn-back').onclick = () => screens.detail.classList.add('hidden');

    document.getElementById('btn-copy').onclick = () => {
        navigator.clipboard.writeText(state.currentPrompt.content);
        const btn = document.getElementById('btn-copy');
        const original = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="check" width="20"></i> Copied!';
        if (window.lucide) lucide.createIcons();
        setTimeout(() => {
            btn.innerHTML = original;
            if (window.lucide) lucide.createIcons();
        }, 2000);
    };

    components.searchInput.oninput = (e) => {
        state.searchQuery = e.target.value;
        clearTimeout(state.searchTimeout);
        state.searchTimeout = setTimeout(loadPrompts, 300);
    };

    components.marketSelect.onchange = (e) => {
        state.selectedMarketId = e.target.value;
        loadTopics();
    };

    components.topicSelect.onchange = (e) => {
        state.selectedTopicId = e.target.value || null;
        loadPrompts();
    };

    // Bottom Nav
    components.navHome.forEach(el => el.onclick = () => showScreen('app'));
    components.navWebsite.forEach(el => el.onclick = () => window.open('https://topas-prompt-library.pages.dev', '_blank'));
    components.navSettings.forEach(el => el.onclick = () => showScreen('settings'));

    // Settings Save
    document.getElementById('btn-settings-save').onclick = () => {
        const triggerChar = components.triggerInput.value.trim() || '?';
        chrome.storage.local.set({ triggerChar }, () => {
            const btn = document.getElementById('btn-settings-save');
            const original = btn.textContent;
            btn.textContent = 'Saved!';
            setTimeout(() => {
                btn.textContent = original;
                showScreen('app');
            }, 1000);
        });
    };

    // Modal
    const modal = {
        container: document.getElementById('modal-container'),
        title: document.getElementById('modal-title'),
        topicForm: document.getElementById('topic-form'),
        promptForm: document.getElementById('prompt-form'),
        topicName: document.getElementById('input-topic-name'),
        promptTitle: document.getElementById('input-prompt-title'),
        promptContent: document.getElementById('input-prompt-content'),
        close: document.getElementById('btn-modal-close'),
        save: document.getElementById('btn-modal-save')
    };

    let modalMode = 'topic';
    let editId = null;

    const showModal = (mode, id = null) => {
        modalMode = mode;
        editId = id;
        modal.container.classList.remove('hidden');
        modal.topicForm.classList.toggle('hidden', mode !== 'topic');
        modal.promptForm.classList.toggle('hidden', mode !== 'prompt');

        if (mode === 'topic') {
            modal.title.textContent = 'Add New Topic';
            modal.topicName.value = '';
        } else {
            if (id) {
                modal.title.textContent = 'Edit Prompt';
                modal.promptTitle.value = state.currentPrompt.title;
                modal.promptContent.value = state.currentPrompt.content;
            } else {
                modal.title.textContent = 'Add New Prompt';
                modal.promptTitle.value = '';
                modal.promptContent.value = '';
            }
        }
    };

    const hideModal = () => modal.container.classList.add('hidden');
    modal.close.onclick = hideModal;
    window.onclick = (e) => { if (e.target === modal.container) hideModal(); };

    document.getElementById('btn-add-prompt-float').onclick = () => showModal('prompt');
    document.getElementById('btn-add-topic').onclick = () => showModal('topic');
    document.getElementById('btn-edit-prompt').onclick = () => showModal('prompt', state.currentPrompt.id);

    modal.save.onclick = async () => {
        try {
            if (modalMode === 'topic') {
                const name = modal.topicName.value.trim();
                if (!name) {
                    customAlert('Vui lòng nhập tên chủ đề.');
                    return;
                }
                const { error } = await supabaseClient.from('topics').insert([{ name, market_id: state.selectedMarketId }]);
                if (error) throw error;
            } else {
                const title = modal.promptTitle.value.trim();
                const content = modal.promptContent.value.trim();
                if (!title || !content) {
                    customAlert('Vui lòng nhập tiêu đề và nội dung.');
                    return;
                }
                
                if (!state.selectedTopicId) {
                    customAlert('Vui lòng chọn một Chủ đề (Topic) trước khi lưu Prompt.');
                    return;
                }

                if (editId) {
                    const { error } = await supabaseClient.from('prompts').update({ title, content }).eq('id', editId);
                    if (error) throw error;
                    state.currentPrompt.title = title;
                    state.currentPrompt.content = content;
                    showDetail(state.currentPrompt);
                } else {
                    const { error } = await supabaseClient.from('prompts').insert([{
                        title, content, topic_id: state.selectedTopicId
                    }]);
                    if (error) throw error;
                }
            }
            hideModal();
            modalMode === 'topic' ? loadTopics() : loadPrompts();
        } catch (err) {
            console.error("Save error:", err);
            customAlert("Lỗi khi lưu: " + (err.message || 'Thử lại sau.'));
        }
    };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

attachGlobalEvents();
init();
