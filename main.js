// --- Config ---
console.log("App.js loading...");
const SUPABASE_URL = 'https://yhrxfnjpgurchgzvjtqw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlocnhmbmpwZ3VyY2hnenZqdHF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1OTU4MjQsImV4cCI6MjA4ODE3MTgyNH0.ig6y9DCHNX-nyN3Rt48Dp7FGA-ZpAqMkFjSmzsAKREw';

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
    alert("Lỗi khởi tạo Supabase: " + e.message);
}

// --- State ---
const state = {
    user: null,
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
    detail: document.getElementById('detail-overlay')
};

const components = {
    marketTabs: document.getElementById('market-tabs'),
    topicTabs: document.getElementById('topic-tabs'),
    promptList: document.getElementById('prompt-list'),
    pinnedList: document.getElementById('pinned-list'),
    searchInput: document.getElementById('input-search'),
    detailTitle: document.getElementById('detail-title'),
    detailContent: document.getElementById('detail-content'),
    userInitial: document.getElementById('user-initial'),
};

// --- Initialization ---
async function init() {
    console.group("Topas App Initialization");
    console.log("Starting init process...");

    try {
        // Load pinned IDs from storage
        chrome.storage.local.get(['pinnedIds'], (result) => {
            state.pinnedIds = result.pinnedIds || [];
            console.log("Pinned IDs loaded:", state.pinnedIds);
        });

        console.log("Checking for existing session...");
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

        if (sessionError) {
            console.error("Error getting session:", sessionError);
        }

        if (session) {
            console.log("Session found for user:", session.user.email);
            handleLogin(session.user);
        } else {
            console.log("No active session, showing login screen.");
            showScreen('login');
        }

        supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log("Auth state change event:", event);
            if (session) {
                handleLogin(session.user);
            } else {
                showScreen('login');
            }
        });
    } catch (err) {
        console.error("Critical error during init:", err);
    } finally {
        console.groupEnd();
    }
}

async function handleLogin(user) {
    state.user = user;
    components.userInitial.textContent = user.email.charAt(0).toUpperCase();
    showScreen('app');

    await loadMarkets();
}

function showScreen(name) {
    Object.keys(screens).forEach(key => {
        screens[key].classList.toggle('hidden', key !== name);
    });
    if (name === 'detail') screens.detail.classList.remove('hidden');
}

// --- Data Fetching ---
async function loadMarkets() {
    const { data: markets } = await supabaseClient.from('markets').select('*').order('name');
    state.markets = markets || [];

    // Get user roles
    const { data: roles } = await supabaseClient.from('user_market_roles').select('market_id').eq('user_id', state.user.id);
    const allowedIds = roles?.map(r => r.market_id) || [];

    // check if user is super admin
    const { data: userProfile } = await supabaseClient.from('users').select('is_super_admin').eq('id', state.user.id).single();

    if (!userProfile?.is_super_admin) {
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
    renderPrompts();
}

// --- Rendering ---
function renderMarkets() {
    components.marketTabs.innerHTML = '';
    state.markets.forEach(m => {
        const tab = document.createElement('div');
        tab.className = `tab ${state.selectedMarketId === m.id ? 'active' : ''}`;
        tab.textContent = m.name;
        tab.onclick = () => {
            state.selectedMarketId = m.id;
            renderMarkets();
            loadTopics();
        };
        components.marketTabs.appendChild(tab);
    });
}

function renderTopics() {
    components.topicTabs.innerHTML = '';

    // All Topics opt
    const allTab = document.createElement('div');
    allTab.className = `tab ${!state.selectedTopicId ? 'active' : ''}`;
    allTab.textContent = 'All Topics';
    allTab.onclick = () => {
        state.selectedTopicId = null;
        renderTopics();
        loadPrompts();
    };
    components.topicTabs.appendChild(allTab);

    state.topics.forEach(t => {
        const tab = document.createElement('div');
        tab.className = `tab ${state.selectedTopicId === t.id ? 'active' : ''}`;
        tab.textContent = t.name;
        tab.onclick = () => {
            state.selectedTopicId = t.id;
            renderTopics();
            loadPrompts();
        };
        components.topicTabs.appendChild(tab);
    });
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
    </div>
  `;

    card.onclick = (e) => {
        const pinBtn = e.target.closest('.pin-icon');
        const copyBtn = e.target.closest('.copy-quick');

        if (pinBtn) {
            togglePin(prompt.id);
            return;
        }

        if (copyBtn) {
            navigator.clipboard.writeText(prompt.content || '');
            const originalHtml = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i data-lucide="check" width="14"></i>';
            copyBtn.classList.add('success');
            setTimeout(() => {
                copyBtn.innerHTML = originalHtml;
                copyBtn.classList.remove('success');
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
    showScreen('detail');
    if (window.lucide) lucide.createIcons();
}

function attachGlobalEvents() {
    console.log("Attaching global events...");

    const loginBtn = document.getElementById('btn-login-google');
    if (loginBtn) {
        loginBtn.onclick = async () => {
            console.log(">>> Login button clicked! Using launchWebAuthFlow <<<");
            try {
                const redirectUrl = chrome.identity.getRedirectURL();
                console.log("Redirect URL:", redirectUrl);

                const { data, error } = await supabaseClient.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: redirectUrl,
                        skipBrowserRedirect: true
                    }
                });

                if (error) throw error;

                console.log("OAuth URL obtained, launching flow...");
                chrome.identity.launchWebAuthFlow(
                    {
                        url: data.url,
                        interactive: true
                    },
                    async (responseUrl) => {
                        if (chrome.runtime.lastError) {
                            console.error("Auth flow error:", chrome.runtime.lastError);
                            return;
                        }

                        console.log("Auth flow response received.");
                        const url = new URL(responseUrl);
                        const access_token = url.hash.match(/access_token=([^&]+)/)?.[1];
                        const refresh_token = url.hash.match(/refresh_token=([^&]+)/)?.[1];

                        if (access_token && refresh_token) {
                            console.log("Tokens found, setting Supabase session...");
                            await supabaseClient.auth.setSession({
                                access_token,
                                refresh_token
                            });
                            console.log("Session set successfully.");
                        } else {
                            console.error("Tokens not found in response URL hash.");
                        }
                    }
                );
            } catch (err) {
                console.error("Login error:", err);
                alert("Lỗi đăng nhập: " + err.message);
            }
        };
        console.log("Login button click handler assigned.");
    } else {
        console.error("CRITICAL: btn-login-google NOT FOUND in document!");
    }

    document.getElementById('btn-logout').onclick = () => supabaseClient.auth.signOut();

    document.getElementById('btn-back').onclick = () => showScreen('app');

    document.getElementById('btn-copy').onclick = () => {
        navigator.clipboard.writeText(state.currentPrompt.content);
        const btn = document.getElementById('btn-copy');
        const original = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="check" width="18"></i> Copied!';
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
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Register events immediately on script load
attachGlobalEvents();

// Start initialization
init();
