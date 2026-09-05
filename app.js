/* ==========================================================================
   GLOBALAUTH CORE CLIENT ENGINE
   ========================================================================== */

let sessionHistory = [];
let dashboardInterval = null;
let timerInterval = null;
let cipherScrambleInterval = null;

let currentLang = 'en';
let currentTheme = localStorage.getItem('theme') || 'dark';
let currentActiveSecret = '';

let activeMasterPassword = null;
let decryptedVaultAccounts = null;

let cameraStream = null;
let cameraAnimationId = null;
let inactivityTimer = null;
let deferredPrompt = null;

/* PWA Promotion Listener */
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btnDesktop = document.getElementById('pwaInstallBtn');
    const btnMobile = document.getElementById('pwaInstallBtnMobile');
    if (btnDesktop) btnDesktop.classList.remove('hidden');
    if (btnMobile) btnMobile.classList.remove('hidden');
});

async function installAppDirectly() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
        const btnDesktop = document.getElementById('pwaInstallBtn');
        const btnMobile = document.getElementById('pwaInstallBtnMobile');
        if (btnDesktop) btnDesktop.classList.add('hidden');
        if (btnMobile) btnMobile.classList.add('hidden');
    }
    deferredPrompt = null;
}

/* Smooth Slide Drawer Toggle */
function toggleMobileMenu() {
    const drawer = document.getElementById('mobileDrawer');
    const backdrop = document.getElementById('mobileDrawerBackdrop');
    if (!drawer || !backdrop) return;

    const isClosed = drawer.classList.contains('translate-x-full');
    if (isClosed) {
        backdrop.classList.remove('hidden');
        requestAnimationFrame(() => {
            backdrop.classList.remove('opacity-0');
            drawer.classList.remove('translate-x-full');
        });
    } else {
        drawer.classList.add('translate-x-full');
        backdrop.classList.add('opacity-0');
        setTimeout(() => {
            backdrop.classList.add('hidden');
        }, 300);
    }
}

/* 5-Min Inactivity Auto-Lock */
function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (activeMasterPassword) {
        inactivityTimer = setTimeout(() => {
            if (activeMasterPassword) {
                lockVault();
                showToast(getTranslatedText('toastAutoLocked'));
            }
        }, 5 * 60 * 1000);
    }
}
['mousemove', 'keydown', 'click', 'touchstart'].forEach(e => 
    window.addEventListener(e, resetInactivityTimer, { passive: true })
);

/* Clean Social Media & Provider Identifier */
function getBrandBadge(name) {
    const lower = name.toLowerCase();
    let brandColor = 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
    let brandName = 'Service';

    if (lower.includes('facebook') || lower.includes('meta')) { 
        brandColor = 'bg-blue-600/10 text-blue-600 dark:text-blue-500 border-blue-600/20'; 
        brandName = 'Facebook'; 
    } else if (lower.includes('instagram') || lower.includes('ig')) { 
        brandColor = 'bg-pink-500/10 text-pink-600 dark:text-pink-500 border-pink-500/20'; 
        brandName = 'Instagram'; 
    } else if (lower.includes('google') || lower.includes('gmail')) { 
        brandColor = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'; 
        brandName = 'Google'; 
    } else if (lower.includes('github')) { 
        brandColor = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'; 
        brandName = 'GitHub'; 
    } else if (lower.includes('discord')) { 
        brandColor = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'; 
        brandName = 'Discord'; 
    } else if (lower.includes('twitter') || lower.includes('x.com')) { 
        brandColor = 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'; 
        brandName = 'Twitter/X'; 
    } else if (lower.includes('tiktok')) { 
        brandColor = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'; 
        brandName = 'TikTok'; 
    } else if (lower.includes('aws') || lower.includes('amazon')) { 
        brandColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20'; 
        brandName = 'AWS'; 
    } else if (lower.includes('binance')) { 
        brandColor = 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-500/20'; 
        brandName = 'Binance'; 
    } else if (lower.includes('telegram')) { 
        brandColor = 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'; 
        brandName = 'Telegram'; 
    } else if (lower.includes('microsoft')) { 
        brandColor = 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'; 
        brandName = 'Microsoft'; 
    } else {
        const parts = name.split(/[:\-_/]/);
        if (parts.length > 0 && parts[0].trim().length > 0) {
            brandName = parts[0].trim();
        }
    }

    return `<span class="text-[9px] font-mono px-1.5 py-0.5 rounded-md border font-bold shrink-0 ${brandColor}">${brandName}</span>`;
}

/* High-Resolution SVG Country Flag Element */
function getCountryFlagElement(code) {
    if (!code || code === 'UN' || code.length !== 2) {
        return `<span class="w-5 h-3.5 inline-flex items-center justify-center rounded-sm bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-500 shrink-0">🌐</span>`;
    }
    const lower = code.toLowerCase();
    return `<img src="https://flagcdn.com/w40/${lower}.png" 
                 srcset="https://flagcdn.com/w80/${lower}.png 2x" 
                 alt="${code}" 
                 class="w-5 h-3.5 object-cover rounded-sm border border-slate-200 dark:border-slate-700 shadow-sm shrink-0" 
                 onerror="this.outerHTML='<span class=\\'text-xs shrink-0\\'>🌐</span>'">`;
}

/* Localization Records */
const translations = {
    en: {
        appSubtitle: "Enterprise 2FA Platform",
        standardTag: "RFC 6238 Standard",
        shortcutHints: "Shortcuts: Ctrl+V / Ctrl+C",
        title: "Authentication Gateway",
        desc: "Enter an encryption token or scan standard OTP provisioning parameters.",
        labelKey: "Secret Token",
        btnUpload: "Upload QR",
        btnCameraScan: "Live Scan",
        cameraModalTitle: "Scan 2FA QR Code",
        cameraTip: "Center QR provisioning code inside the optical guide",
        secretPlaceholder: "Paste key or otpauth:// link...",
        cryptoParamsTitle: "Cryptographic Parameters",
        autoDetectedHint: "Auto-detected from URIs",
        labelAlgo: "Algorithm",
        optSha1: "SHA-1 (Default)",
        labelDigits: "Digits",
        opt6Digits: "6 Digits",
        opt7Digits: "7 Digits",
        opt8Digits: "8 Digits",
        labelPeriod: "Cycle Window",
        opt30s: "30 Seconds",
        opt60s: "60 Seconds",
        btnGen: "Generate Token",
        btnSaveVault: "Save to Vault",
        labelCode: "Security Code",
        badgeActive: "Active",
        btnCopy: "Copy Code",
        historyTitle: "Recent History",
        btnClearHistory: "Clear All",
        historySearchPlaceholder: "Filter history...",
        noHistory: "No entries recorded in current session",
        navNotes: "Guide",
        navGrid: "Live Grid",
        vault: "Vault",
        admin: "Admin",
        alertNotice: "Security Notice",
        btnAcknowledge: "Acknowledge",
        promptAccountLabel: "Account Identifier",
        promptSpecifyId: "Assign a recognizable label for this key pair.",
        btnCancel: "Cancel",
        btnConfirm: "Confirm",
        confirmDeleteTitle: "Delete Entry?",
        confirmDeleteDesc: "This key will be permanently removed.",
        btnDelete: "Delete",
        notesHeading: "Platform Documentation",
        notesSubHeading: "Architecture & Operational Manual",
        btnClose: "Close",
        vaultModalTitle: "Encrypted Account Vault",
        vaultCreateTitle: "Create Master Password",
        vaultCreateDesc: "Set a master passphrase to secure your local encrypted database.",
        vaultUnlockTitle: "Unlock Your Vault",
        vaultUnlockDesc: "Enter your master password to decrypt saved keys.",
        vaultMasterPassPlaceholder: "Enter custom master password...",
        vaultConfirmPassPlaceholder: "Confirm custom master password...",
        btnSavePassword: "Save Password",
        btnUnlockVault: "Unlock Vault",
        vaultSearchPlaceholder: "Search stored accounts...",
        btnBackup: "Backup",
        btnRestore: "Restore",
        btnLock: "Lock",
        dashboardTitle: "Multi-Account Live Stream",
        cycleLabel: "Cycle:",
        adminAuthTitle: "Admin Authentication",
        adminPinPlaceholder: "Passcode...",
        adminPinError: "Invalid Passcode",
        btnAuthenticate: "Authenticate",
        telemetryTitle: "Telemetry & Access Logs",
        statVisitors: "Unique Visitors",
        statGenerations: "Tokens Generated",
        storedIpLogs: "Audit Log Stream",
        noTelemetry: "No telemetry recorded yet...",
        toastMsg: "Copied to clipboard!",
        toastCopiedMorphed: "Copied!",
        toastSecretPasted: "Secret token pasted",
        toastHistoryCleared: "Session history cleared",
        toastBackupExported: "Backup exported successfully",
        toastVaultUnlocked: "Vault decrypted successfully",
        toastPassCreated: "Vault master password initialized",
        toastVaultLocked: "Vault locked",
        toastAutoLocked: "Vault auto-locked due to inactivity",
        toastAccountSaved: "Account encrypted & saved to vault",
        toastAccountRemoved: "Account removed",
        toastQrDetected: "QR parameters parsed successfully",
        errEmpty: "Please provide a valid Base32 secret string.",
        errFormat: "Invalid secret token format.",
        errScanFailed: "No valid 2FA QR code was recognized.",
        errAccessDenied: "Incorrect master password provided.",
        errMismatch: "Master passwords do not match. Please re-enter.",
        errCameraAccess: "Unable to access camera. Verify device permissions.",
        btnUse: "Use",
        emptyVaultMsg: "No credentials stored in vault",
        welcomeMsg: "Welcome"
    },
    km: {
        appSubtitle: "កម្មវិធីផ្ទៀងផ្ទាត់កម្រិតខ្ពស់ 2FA",
        standardTag: "ស្តង់ដារ RFC 6238",
        shortcutHints: "ផ្លូវកាត់៖ Ctrl+V / Ctrl+C",
        title: "ច្រកផ្ទៀងផ្ទាត់សុវត្ថិភាព",
        desc: "បញ្ចូលលេខកូដសម្ងាត់ ឬស្កេន QR Code ដើម្បីទទួលបានលេខកូដសុវត្ថិភាព។",
        labelKey: "លេខកូដសម្ងាត់ (Secret Key)",
        btnUpload: "ស្កេន QR",
        btnCameraScan: "ស្កេនកាមេរ៉ា",
        cameraModalTitle: "ស្កេនកូដ QR 2FA",
        cameraTip: "តម្រង់កូដ QR ឱ្យចំប្រអប់កណ្តាល",
        secretPlaceholder: "បិទភ្ជាប់កូដ ឬតំណភ្ជាប់ otpauth://...",
        cryptoParamsTitle: "ប៉ារ៉ាម៉ែត្រកូដសម្ងាត់",
        autoDetectedHint: "ស្វែងរកស្វ័យប្រវត្តពី URI",
        labelAlgo: "ក្បួនដោះស្រាយ (Algorithm)",
        optSha1: "SHA-1 (លំនាំដើម)",
        labelDigits: "ចំនួនខ្ទង់លេខ",
        opt6Digits: "៦ ខ្ទង់",
        opt7Digits: "៧ ខ្ទង់",
        opt8Digits: "៨ ខ្ទង់",
        labelPeriod: "រយៈពេល (Period)",
        opt30s: "៣០ វិនាទី",
        opt60s: "៦០ វិនាទី",
        btnGen: "បង្កើតលេខកូដ",
        btnSaveVault: "រក្សាទុកក្នុង Vault",
        labelCode: "លេខកូដសុវត្ថិភាព",
        badgeActive: "សកម្ម",
        btnCopy: "ចម្លងកូដ",
        historyTitle: "ប្រវត្តិថ្មីៗ",
        btnClearHistory: "សម្អាតទាំងអស់",
        historySearchPlaceholder: "ស្វែងរកក្នុងប្រវត្តិ...",
        noHistory: "មិនទាន់មានទិន្នន័យត្រូវបានកត់ត្រា",
        navNotes: "សៀវភៅណែនាំ",
        navGrid: "Live Grid",
        vault: "Vault",
        admin: "Admin",
        alertNotice: "ដំណឹងសុវត្ថិភាព",
        btnAcknowledge: "យល់ព្រម",
        promptAccountLabel: "ឈ្មោះគណនី",
        promptSpecifyId: "កំណត់អត្តសញ្ញាណសម្រាប់កូដសម្ងាត់នេះ។",
        btnCancel: "បោះបង់",
        btnConfirm: "យល់ព្រម",
        confirmDeleteTitle: "លុបគណនី?",
        confirmDeleteDesc: "កូដសម្ងាត់នេះនឹងត្រូវលុបជាអចិន្ត្រៃយ៍។",
        btnDelete: "លុបចេញ",
        notesHeading: "សៀវភៅណែនាំអំពីរបៀបប្រើប្រាស់",
        notesSubHeading: "រចនាសម្ព័ន្ធ និងដំណើរការប្រតិបត្តិការ",
        btnClose: "បិទ",
        vaultModalTitle: "កន្លែងផ្ទុកគណនីសុវត្ថិភាព Vault",
        vaultCreateTitle: "បង្កើត Master Password",
        vaultCreateDesc: "កំណត់ពាក្យសម្ងាត់ផ្ទាល់ខ្លួនដើម្បីការពារទិន្នន័យរបស់អ្នក។",
        vaultUnlockTitle: "ដោះសោរកន្លែងផ្ទុក Vault",
        vaultUnlockDesc: "បញ្ចូល Master Password របស់អ្នកដើម្បីដោះសោកូដសម្ងាត់។",
        vaultMasterPassPlaceholder: "បញ្ចូល Master Password...",
        vaultConfirmPassPlaceholder: "បញ្ជាក់ Master Password...",
        btnSavePassword: "រក្សាទុកពាក្យសម្ងាត់",
        btnUnlockVault: "ដោះសោរ Vault",
        vaultSearchPlaceholder: "ស្វែងរកគណនីដែលបានរក្សាទុក...",
        btnBackup: "ទាញទុក (Backup)",
        btnRestore: "បញ្ចូលឡើងវិញ",
        btnLock: "ចាក់សោរ",
        dashboardTitle: "ផ្ទាំងបង្ហាញកូដបន្តផ្ទាល់ (Live Grid)",
        cycleLabel: "វដ្ត៖",
        adminAuthTitle: "ការផ្ទៀងផ្ទាត់ Admin",
        adminPinPlaceholder: "លេខកូដសម្ងាត់...",
        adminPinError: "លេខកូដសម្ងាត់មិនត្រឹមត្រូវ",
        btnAuthenticate: "ផ្ទៀងផ្ទាត់",
        telemetryTitle: "កំណត់ត្រា និងការចូលប្រើប្រាស់",
        statVisitors: "ចំនួនអ្នកទស្សនា",
        statGenerations: "កូដដែលបានបង្កើត",
        storedIpLogs: "កំណត់ត្រាអាសយដ្ឋាន IP ចូលប្រើ",
        noTelemetry: "មិនទាន់មានកំណត់ត្រាត្រូវបានរក្សាទុក...",
        toastMsg: "បានចម្លងជោគជ័យ!",
        toastCopiedMorphed: "បានចម្លង!",
        toastSecretPasted: "បានបិទភ្ជាប់កូដ!",
        toastHistoryCleared: "បានសម្អាតប្រវត្តិទាំងអស់",
        toastBackupExported: "បានទាញយកឯកសារ Backup ជោគជ័យ!",
        toastVaultUnlocked: "ដោះសោរ Vault ជោគជ័យ!",
        toastPassCreated: "បានបង្កើតពាក្យសម្ងាត់ និងដោះសោរ Vault!",
        toastVaultLocked: "បានចាក់សោរ Vault",
        toastAutoLocked: "Vault បានចាក់សោរស្វ័យប្រវត្តដោយសារអសកម្ម",
        toastAccountSaved: "បានរក្សាទុកគណនីក្នុង Vault!",
        toastAccountRemoved: "បានលុបគណនីចេញ",
        toastQrDetected: "បានស្កេន និងរកឃើញកូដ QR!",
        errEmpty: "សូមបញ្ចូលលេខកូដសម្ងាត់ជាមុនសិន។",
        errFormat: "ទម្រង់លេខកូដសម្ងាត់មិនត្រឹមត្រូវ។",
        errScanFailed: "មិនអាចស្វែងរកកូដ QR ក្នុងរូបភាពនេះទេ។",
        errAccessDenied: "ពាក្យសម្ងាត់មិនត្រឹមត្រូវ!",
        errMismatch: "ពាក្យសម្ងាត់ទាំងពីរមិនដូចគ្នាទេ។",
        errCameraAccess: "មិនអាចបើកកាមេរ៉ាបានទេ។ សូមពិនិត្យសិទ្ធិកាមេរ៉ា។",
        btnUse: "ប្រើប្រាស់",
        emptyVaultMsg: "មិនទាន់មានទិន្នន័យក្នុង Vault ទេ",
        welcomeMsg: "សូមស្វាគមន៍"
    },
    zh: {
        appSubtitle: "企业级 2FA 身份验证平台",
        standardTag: "RFC 6238 国际标准",
        shortcutHints: "快捷键：Ctrl+V / Ctrl+C",
        title: "双重身份验证网关",
        desc: "输入 Base32 密钥或扫描二维码即可生成安全动态验证码。",
        labelKey: "密钥 (Secret Token)",
        btnUpload: "上传二维码",
        btnCameraScan: "实时扫码",
        cameraModalTitle: "扫描 2FA 二维码",
        cameraTip: "将二维码对准中心方框",
        secretPlaceholder: "粘贴密钥或 otpauth:// 协议链接...",
        cryptoParamsTitle: "加密哈希参数",
        autoDetectedHint: "自动从协议链接中识别",
        labelAlgo: "哈希算法",
        optSha1: "SHA-1 (默认)",
        labelDigits: "验证码位数",
        opt6Digits: "6 位",
        opt7Digits: "7 位",
        opt8Digits: "8 位",
        labelPeriod: "刷新周期",
        opt30s: "30 秒",
        opt60s: "60 秒",
        btnGen: "生成动态验证码",
        btnSaveVault: "安全保存至密码库",
        labelCode: "安全动态码",
        badgeActive: "运行中",
        btnCopy: "复制验证码",
        historyTitle: "生成记录",
        btnClearHistory: "清除所有",
        historySearchPlaceholder: "过滤历史记录...",
        noHistory: "当前会话暂无生成记录",
        navNotes: "指南",
        navGrid: "实时网格",
        vault: "密码库",
        admin: "管理后台",
        alertNotice: "安全提示",
        btnAcknowledge: "确认",
        promptAccountLabel: "账户标识",
        promptSpecifyId: "请为该密钥对指定一个名称。",
        btnCancel: "取消",
        btnConfirm: "确认",
        confirmDeleteTitle: "删除账户？",
        confirmDeleteDesc: "该密钥将被永久清除，无法恢复。",
        btnDelete: "删除",
        notesHeading: "平台使用指南与文档",
        notesSubHeading: "系统架构与使用流程",
        btnClose: "关闭",
        vaultModalTitle: "零知识加密密码库 (Vault)",
        vaultCreateTitle: "创建主密码",
        vaultCreateDesc: "请设置自定义主密码以保护您的本地密钥数据库。",
        vaultUnlockTitle: "解锁您的密码库",
        vaultUnlockDesc: "请输入主密码以解密查看您保存的密钥。",
        vaultMasterPassPlaceholder: "输入自定义主密码...",
        vaultConfirmPassPlaceholder: "确认自定义主密码...",
        btnSavePassword: "保存密码",
        btnUnlockVault: "解锁密码库",
        vaultSearchPlaceholder: "搜索保存的账户...",
        btnBackup: "备份",
        btnRestore: "恢复",
        btnLock: "锁定",
        dashboardTitle: "多账户实时监控网格",
        cycleLabel: "周期：",
        adminAuthTitle: "管理员身份验证",
        adminPinPlaceholder: "输入口令...",
        adminPinError: "通行口令错误",
        btnAuthenticate: "验证登录",
        telemetryTitle: "访问日志与遥测监控",
        statVisitors: "独立访客数",
        statGenerations: "生成动态码总数",
        storedIpLogs: "IP 访问与操作审计日志",
        noTelemetry: "暂无审计日志...",
        toastMsg: "已成功复制到剪贴板！",
        toastCopiedMorphed: "已复制！",
        toastSecretPasted: "已粘贴密钥！",
        toastHistoryCleared: "已清空会话历史",
        toastBackupExported: "备份导出成功！",
        toastVaultUnlocked: "密码库解密成功！",
        toastPassCreated: "主密码创建成功，密码库已解锁！",
        toastVaultLocked: "密码库已锁定。",
        toastAutoLocked: "长时间无操作，密码库已自动锁定",
        toastAccountSaved: "已加密保存到密码库！",
        toastAccountRemoved: "账户已移除。",
        toastQrDetected: "成功识别并解析二维码！",
        errEmpty: "请输入有效的 Base32 密钥字符串。",
        errFormat: "密钥格式错误。",
        errScanFailed: "未能在图片中定位有效的二维码。",
        errAccessDenied: "主密码错误！",
        errMismatch: "两次输入的密码不一致，请重新输入。",
        errCameraAccess: "无法调用摄像头，请检查权限设置。",
        btnUse: "使用",
        emptyVaultMsg: "密码库中暂无保存的账户",
        welcomeMsg: "欢迎"
    }
};

function getTranslatedText(key) {
    return (translations[currentLang] && translations[currentLang][key]) || (translations['en'][key] || key);
}

/* Quick Clipboard Helper */
async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            document.getElementById('secretInput').value = text.trim();
            parseSecretUriParams();
            showToast(getTranslatedText('toastSecretPasted'));
        }
    } catch (err) {
        document.getElementById('secretInput').focus();
    }
}

/* IP Geolocation Telemetry Logger */
async function logVisitorAccess(action = "Page Visit") {
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        
        if (data && data.ip) {
            const countryCode = data.country_code || 'UN';
            const countryName = data.country_name || 'Unknown Region';

            const logs = JSON.parse(localStorage.getItem('admin_ip_logs') || '[]');
            logs.unshift({
                ip: data.ip,
                countryCode: countryCode,
                countryName: countryName,
                action: action,
                time: new Date().toLocaleString()
            });
            
            localStorage.setItem('admin_ip_logs', JSON.stringify(logs.slice(0, 60)));

            let visitors = parseInt(localStorage.getItem('stat_visitors') || '0', 10);
            if (action === "Page Visit") {
                localStorage.setItem('stat_visitors', (visitors + 1).toString());
            }
        }
    } catch (err) {
        try {
            const fallbackRes = await fetch('https://api.ipify.org?format=json');
            const fallbackData = await fallbackRes.json();
            if (fallbackData && fallbackData.ip) {
                const logs = JSON.parse(localStorage.getItem('admin_ip_logs') || '[]');
                logs.unshift({
                    ip: fallbackData.ip,
                    countryCode: 'UN',
                    countryName: 'Unknown',
                    action: action,
                    time: new Date().toLocaleString()
                });
                localStorage.setItem('admin_ip_logs', JSON.stringify(logs.slice(0, 60)));
            }
        } catch (e) {}
    }
}
window.addEventListener('load', () => logVisitorAccess("Page Visit"));

/* Tab Refresh Utility */
function triggerUniversalTabRefresh() {
    const icon = document.getElementById('refreshIcon');
    const container = document.getElementById('mainTabContainer');

    if (icon) {
        icon.style.transform = 'rotate(360deg)';
        icon.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
    }
    if (container) {
        container.style.opacity = '0.5';
        container.style.transform = 'scale(0.99)';
    }
    setTimeout(() => {
        window.location.reload();
    }, 250);
}

/* Platform Guide Documentation Content */
const platformNotesData = {
    en: [
        {
            title: "1. Token Ingestion & QR Code Scanning",
            desc: "Paste any standard Base32 secret string or complete otpauth:// URI scheme into the Secret Token field. Click 'Upload QR' or 'Live Scan' to extract provisioned keys directly with your camera."
        },
        {
            title: "2. Cryptographic Parameters",
            desc: "Customize your hash algorithm (SHA-1, SHA-256, SHA-512), code length (6, 7, or 8 digits), and cycle duration (30s or 60s). These settings are auto-detected from valid otpauth:// URIs."
        },
        {
            title: "3. Generating & Copying Security Codes",
            desc: "Click 'Generate Token' to run client-side RFC 6238 HMAC cryptographic signing. The code updates smoothly in sync with the standard 30-second window. Click 'Copy Code' to copy it to your clipboard."
        },
        {
            title: "4. Zero-Knowledge Client-Side Encrypted Vault",
            desc: "Click 'Vault' in the top navigation or press Ctrl+K. Set your custom master password to initialize local PBKDF2/AES-GCM encryption. Save accounts, pin top accounts, or click 'Use' to load secrets directly back to the generator."
        },
        {
            title: "5. Backup Export, Restore & Hotkeys",
            desc: "Click 'Backup' inside the unlocked vault to export your encrypted database as a .json file. Restore it anywhere using 'Restore'. Shortcuts: Ctrl+V (paste token), Ctrl+C (copy code), Ctrl+K (open vault), and Escape (close modals)."
        },
        {
            title: "6. Multi-Account Live Grid",
            desc: "Click 'Live Grid' in the header to view and monitor all your stored accounts in real time with synchronized 30-second countdown timers."
        }
    ],
    km: [
        {
            title: "១. ការបញ្ចូលលេខកូដ និងស្កេន QR Code",
            desc: "សូមចម្លង និងបិទភ្ជាប់លេខកូដ Base32 ឬតំណភ្ជាប់ otpauth:// ទៅក្នុងប្រអប់ Secret Token។ អ្នកក៏អាចចុច 'ស្កេន QR' ឬ 'ស្កេនកាមេរ៉ា' ដើម្បីទាញយកលេខកូដដោយផ្ទាល់ពីកាមេរ៉ាទូរស័ព្ទផងដែរ។"
        },
        {
            title: "២. ការកំណត់ក្បួនដោះស្រាយ និងខ្ទង់លេខ",
            desc: "កំណត់ប្រភេទ Hash Algorithm (SHA-1, SHA-256, SHA-512) ចំនួនខ្ទង់លេខ (៦, ៧ ឬ ៨ ខ្ទង់) និងរយៈពេល (៣០ វិនាទី ឬ ៦០ វិនាទី) តាមតម្រូវការគណនីរបស់អ្នក។"
        },
        {
            title: "៣. ការបង្កើត និងចម្លងលេខកូដសម្ងាត់",
            desc: "ចុច 'បង្កើតកូដ' ដើម្បីទទួលបានលេខកូដ TOTP ភ្លាមៗស្របតាមស្តង់ដារអន្តរជាតិ។ ចុចប៊ូតុងចម្លងដើម្បីចម្លងលេខកូដទៅកាន់ក្ដារតម្បៀតខ្ទាស់។"
        },
        {
            title: "៤. ប្រព័ន្ធរក្សាទុកសុវត្ថិភាព Vault (AES-GCM)",
            desc: "ចុចប៊ូតុង 'Vault' ឬចុច Ctrl+K ដើម្បីបង្កើត និងដោះសោរកន្លែងផ្ទុកគណនីដោយប្រើ Master Password ផ្ទាល់ខ្លួនរបស់អ្នក។"
        },
        {
            title: "៥. ការទាញយកទុក ការបញ្ចូលឡើងវិញ និងផ្លូវកាត់ក្តារចុច",
            desc: "ចុច 'Backup' ដើម្បីទាញយកឯកសារ .json ដែលបានអ៊ិនគ្រីបទុកជាឯកសារជំនួយ។ ផ្លូវកាត់ក្តារចុច៖ Ctrl+V (បិទភ្ជាប់), Ctrl+C (ចម្លងកូដ), Ctrl+K (បើក Vault), និង Esc (បិទផ្ទាំង)។"
        },
        {
            title: "៦. ផ្ទាំងបង្ហាញកូដបន្តផ្ទាល់ (Live Grid)",
            desc: "ចុចលើ 'Live Grid' នៅផ្នែកខាងលើដើម្បីមើលលេខកូដ OTP នៃគ្រប់គណនីរបស់អ្នកដែលដំណើរការដំណាលគ្នាក្នុងពេលជាក់ស្តែង។"
        }
    ],
    zh: [
        {
            title: "1. 密钥输入与二维码解析",
            desc: "在密钥框输入 Base32 密钥字符串或完整的 otpauth:// 协议链接。也可点击右上角“上传二维码”或“实时扫码”直接调用摄像头扫描。"
        },
        {
            title: "2. 加密参数与位数自定义",
            desc: "自由配置哈希算法（SHA-1、SHA-256、SHA-512）、验证码位数（6、7 或 8 位）以及更新周期（30秒或60秒）。"
        },
        {
            title: "3. 动态验证码生成与复制",
            desc: "点击“生成动态验证码”即时生成符合 RFC 6238 标准的动态口令。点击复制按钮即可复制。"
        },
        {
            title: "4. 端到端零知识加密密码库 (Vault)",
            desc: "点击顶部“密码库”或按下快捷键 Ctrl+K，自定义设置主密码以初始化 AES-GCM 本地加密库。"
        },
        {
            title: "5. 备份导出恢复与全局快捷键",
            desc: "在密码库中点击“备份”可导出加密的 .json 备份文件，随时点击“恢复”导入。快捷键：Ctrl+V（粘贴）、Ctrl+C（复制）、Ctrl+K（打开密码库）、Esc（退出）。"
        },
        {
            title: "6. 多账户实时仪表盘 (Live Grid)",
            desc: "点击导航栏中的“实时仪表盘”可同时监控密码库中所有账户的实时动态口令与倒计时进度。"
        }
    ]
};

function renderNotesContent() {
    const container = document.getElementById('notesContainer');
    if (!container) return;

    const notes = platformNotesData[currentLang] || platformNotesData['en'];
    container.innerHTML = notes.map(item => `
        <div class="card-inner p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
            <h4 class="font-bold text-xs text-brand-600 dark:text-brand-400">${item.title}</h4>
            <p class="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">${item.desc}</p>
        </div>
    `).join('');
}

function openNotesModal() {
    renderNotesContent();
    document.getElementById('notesModal').classList.remove('hidden');
}

function closeNotesModal() {
    document.getElementById('notesModal').classList.add('hidden');
}

/* Custom Selection Dropdowns */
function toggleDropdownMenu(menuId) {
    const menu = document.getElementById(menuId);
    const isHidden = menu.classList.contains('hidden');
    closeAllCustomDropdowns();
    if (isHidden) menu.classList.remove('hidden');
}

function closeAllCustomDropdowns() {
    document.querySelectorAll('.custom-dropdown-panel').forEach(el => el.classList.add('hidden'));
}

window.addEventListener('click', (e) => {
    if (!e.target.closest('.space-y-1.relative')) closeAllCustomDropdowns();
});

function chooseOption(hiddenInputId, labelId, value, displayLabel, menuId) {
    document.getElementById(hiddenInputId).value = value;
    document.getElementById(labelId).innerText = displayLabel;

    const menu = document.getElementById(menuId);
    menu.querySelectorAll('.dropdown-item').forEach(item => {
        const check = item.querySelector('.checkmark');
        if (item.innerText.includes(displayLabel) || item.innerText.trim() === value) {
            item.classList.add('selected');
            item.classList.remove('text-slate-700', 'dark:text-slate-300');
            if (check) check.classList.remove('hidden');
        } else {
            item.classList.remove('selected');
            item.classList.add('text-slate-700', 'dark:text-slate-300');
            if (check) check.classList.add('hidden');
        }
    });
    closeAllCustomDropdowns();
}

/* Cryptographic Storage Primitives (PBKDF2 / AES-GCM 256) */
function bufferToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
}

function base64ToBuffer(b64) {
    const binary = window.atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
    );
    return window.crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

async function encryptData(password, data) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const ciphertext = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, encoded);
    return {
        ciphertext: bufferToBase64(ciphertext),
        iv: bufferToBase64(iv),
        salt: bufferToBase64(salt)
    };
}

async function decryptData(password, encryptedObj) {
    if (!encryptedObj.salt || !encryptedObj.iv || !encryptedObj.ciphertext) {
        throw new Error("Invalid payload format");
    }
    const salt = new Uint8Array(base64ToBuffer(encryptedObj.salt));
    const iv = new Uint8Array(base64ToBuffer(encryptedObj.iv));
    const ciphertext = base64ToBuffer(encryptedObj.ciphertext);
    const key = await deriveKey(password, salt);
    const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ciphertext);
    return JSON.parse(new TextDecoder().decode(decrypted));
}

/* Vault Management Lifecycle */
function openVaultModal() {
    document.getElementById('vaultModal').classList.remove('hidden');
    const hasStoredVault = localStorage.getItem('globalauth_vault');
    const confirmInput = document.getElementById('confirmPasswordInput');
    const authBtn = document.getElementById('vaultAuthBtn');

    if (activeMasterPassword && decryptedVaultAccounts) {
        document.getElementById('vaultAuthSection').classList.add('hidden');
        document.getElementById('vaultContentSection').classList.remove('hidden');
        renderVaultAccounts();
        updateVaultDot(true);
    } else {
        document.getElementById('vaultAuthSection').classList.remove('hidden');
        document.getElementById('vaultContentSection').classList.add('hidden');
        document.getElementById('masterPasswordInput').value = '';
        if (confirmInput) confirmInput.value = '';

        if (!hasStoredVault) {
            document.getElementById('vaultAuthTitle').innerText = getTranslatedText('vaultCreateTitle');
            document.getElementById('vaultAuthDesc').innerText = getTranslatedText('vaultCreateDesc');
            authBtn.innerText = getTranslatedText('btnSavePassword');
            confirmInput.classList.remove('hidden');
        } else {
            document.getElementById('vaultAuthTitle').innerText = getTranslatedText('vaultUnlockTitle');
            document.getElementById('vaultAuthDesc').innerText = getTranslatedText('vaultUnlockDesc');
            authBtn.innerText = getTranslatedText('btnUnlockVault');
            confirmInput.classList.add('hidden');
        }
        updateVaultDot(false);
    }
}

function closeVaultModal() {
    document.getElementById('vaultModal').classList.add('hidden');
}

async function handleVaultAuth() {
    const password = document.getElementById('masterPasswordInput').value;
    const confirmPass = document.getElementById('confirmPasswordInput')?.value;
    const hasStoredVault = localStorage.getItem('globalauth_vault');

    if (!password || password.trim().length === 0) {
        showModernAlert(getTranslatedText('alertNotice'), getTranslatedText('errEmpty'));
        return;
    }

    if (!hasStoredVault) {
        if (!confirmPass || confirmPass.trim().length === 0 || password !== confirmPass) {
            showModernAlert(getTranslatedText('alertNotice'), getTranslatedText('errMismatch'));
            return;
        }

        try {
            const emptyEncrypted = await encryptData(password, []);
            localStorage.setItem('globalauth_vault', JSON.stringify(emptyEncrypted));
            activeMasterPassword = password;
            decryptedVaultAccounts = [];
            resetInactivityTimer();
            
            logVisitorAccess("Initialized Master Password");

            document.getElementById('vaultAuthSection').classList.add('hidden');
            document.getElementById('vaultContentSection').classList.remove('hidden');
            renderVaultAccounts();
            updateVaultDot(true);
            showToast(getTranslatedText('toastPassCreated'));
        } catch (e) {
            showModernAlert(getTranslatedText('alertNotice'), "Could not initialize encrypted vault.");
        }
        return;
    }

    try {
        let encryptedObj = JSON.parse(localStorage.getItem('globalauth_vault'));
        if (Array.isArray(encryptedObj.ciphertext)) {
            encryptedObj = {
                ciphertext: bufferToBase64(new Uint8Array(encryptedObj.ciphertext)),
                iv: bufferToBase64(new Uint8Array(encryptedObj.iv)),
                salt: bufferToBase64(new Uint8Array(encryptedObj.salt))
            };
        }

        const result = await decryptData(password, encryptedObj);
        activeMasterPassword = password;
        decryptedVaultAccounts = Array.isArray(result) ? result : [];
        resetInactivityTimer();

        logVisitorAccess("Unlocked Vault");

        document.getElementById('vaultAuthSection').classList.add('hidden');
        document.getElementById('vaultContentSection').classList.remove('hidden');
        renderVaultAccounts();
        updateVaultDot(true);
        showToast(getTranslatedText('toastVaultUnlocked'));
    } catch (err) {
        showModernAlert(getTranslatedText('alertNotice'), getTranslatedText('errAccessDenied'));
    }
}

function lockVault() {
    activeMasterPassword = null;
    decryptedVaultAccounts = null;
    if (inactivityTimer) clearTimeout(inactivityTimer);
    document.getElementById('vaultAuthSection').classList.remove('hidden');
    document.getElementById('vaultContentSection').classList.add('hidden');
    document.getElementById('masterPasswordInput').value = '';
    const confirmInput = document.getElementById('confirmPasswordInput');
    if (confirmInput) confirmInput.value = '';
    updateVaultDot(false);
    showToast(getTranslatedText('toastVaultLocked'));
}

function updateVaultDot(unlocked) {
    const dot = document.getElementById('vaultStatusDot');
    const dotMobile = document.getElementById('vaultStatusDotMobile');
    if (dot) {
        dot.className = unlocked 
            ? "w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] shrink-0" 
            : "w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600 shrink-0";
    }
    if (dotMobile) {
        dotMobile.className = unlocked 
            ? "w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.9)] absolute top-2 right-2" 
            : "w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-600 absolute top-2 right-2";
    }
}

async function saveAccountToVault() {
    const secret = getSanitizedSecret();
    if (!secret) {
        showModernAlert(getTranslatedText('alertNotice'), getTranslatedText('errEmpty'));
        return;
    }

    if (!activeMasterPassword) {
        openVaultModal();
        showModernAlert(getTranslatedText('alertNotice'), getTranslatedText('errEmpty'));
        return;
    }

    const accounts = decryptedVaultAccounts || [];
    const defaultName = `Token #${accounts.length + 1}`;
    accounts.push({
        name: defaultName,
        secret: secret,
        algorithm: document.getElementById('otpAlgorithmSelect').value,
        digits: document.getElementById('otpDigitsSelect').value,
        period: document.getElementById('otpPeriodSelect').value,
        pinned: false
    });

    try {
        const encrypted = await encryptData(activeMasterPassword, accounts);
        localStorage.setItem('globalauth_vault', JSON.stringify(encrypted));
        decryptedVaultAccounts = accounts;
        resetInactivityTimer();
        renderVaultAccounts();
        showToast(getTranslatedText('toastAccountSaved'));
    } catch (err) {
        showModernAlert(getTranslatedText('alertNotice'), "Could not save token.");
    }
}

async function updateVaultStorage() {
    if (!activeMasterPassword || !decryptedVaultAccounts) return;
    const encrypted = await encryptData(activeMasterPassword, decryptedVaultAccounts);
    localStorage.setItem('globalauth_vault', JSON.stringify(encrypted));
    resetInactivityTimer();
}

function renderVaultAccounts() {
    const listEl = document.getElementById('vaultAccountsList');
    const search = (document.getElementById('vaultSearchInput')?.value || '').toLowerCase();

    if (!decryptedVaultAccounts || decryptedVaultAccounts.length === 0) {
        listEl.innerHTML = `<div class="p-4 text-center text-xs text-slate-400 italic">${getTranslatedText('emptyVaultMsg')}</div>`;
        return;
    }

    const filtered = decryptedVaultAccounts.filter(acc => 
        acc.name.toLowerCase().includes(search) || acc.secret.toLowerCase().includes(search)
    );
    filtered.sort((a, b) => (b.pinned === true) - (a.pinned === true));

    if (filtered.length === 0) {
        listEl.innerHTML = `<div class="p-4 text-center text-xs text-slate-400 italic">${getTranslatedText('emptyVaultMsg')}</div>`;
        return;
    }

    listEl.innerHTML = filtered.map(acc => {
        const realIndex = decryptedVaultAccounts.indexOf(acc);
        const algo = acc.algorithm || 'SHA-1';
        const digits = acc.digits || '6';
        const maskedSecret = acc.secret.length > 6 ? acc.secret.substring(0, 4) + '••••••••' : '••••••••';
        
        let cleanName = acc.name;
        if (cleanName.includes(':')) {
            const parts = cleanName.split(':');
            cleanName = parts[1].trim() || parts[0].trim();
        }
        const brandBadge = getBrandBadge(acc.name);

        return `
            <div class="flex items-center justify-between p-3 rounded-xl card-inner hover:border-brand-500/40 transition-colors gap-2 shadow-sm">
                <div class="min-w-0 flex-grow pr-2">
                    <div class="flex items-center gap-2 flex-wrap">
                        ${brandBadge}
                        <span class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">${cleanName}</span>
                        <span class="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold border border-brand-500/20">${algo}/${digits}D</span>
                        ${acc.pinned ? '<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">Pinned</span>' : ''}
                    </div>
                    <span class="text-[10px] font-mono text-slate-400 dark:text-slate-500 block truncate mt-1">${maskedSecret}</span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button onclick="togglePinAccount(${realIndex})" class="w-8 h-8 rounded-lg card-inner text-slate-400 hover:text-amber-500 flex items-center justify-center btn-modern" title="Pin">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                    </button>
                    <button onclick="renameAccount(${realIndex})" class="w-8 h-8 rounded-lg card-inner text-slate-400 hover:text-brand-500 flex items-center justify-center btn-modern" title="Rename">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button onclick="loadVaultAccount(${realIndex})" class="px-3 h-8 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold btn-modern shadow-sm">${getTranslatedText('btnUse')}</button>
                    <button onclick="deleteVaultAccount(${realIndex})" class="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 flex items-center justify-center btn-modern" title="Delete">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function togglePinAccount(index) {
    decryptedVaultAccounts[index].pinned = !decryptedVaultAccounts[index].pinned;
    await updateVaultStorage();
    renderVaultAccounts();
}

function renameAccount(index) {
    showModernPrompt({
        title: getTranslatedText('promptAccountLabel'),
        defaultValue: decryptedVaultAccounts[index].name,
        onConfirm: async (val) => {
            if (val && val.trim().length > 0) {
                decryptedVaultAccounts[index].name = val.trim();
                await updateVaultStorage();
                renderVaultAccounts();
            }
        }
    });
}

function deleteVaultAccount(index) {
    showModernConfirm({
        title: getTranslatedText('confirmDeleteTitle'),
        desc: getTranslatedText('confirmDeleteDesc'),
        onConfirm: async () => {
            decryptedVaultAccounts.splice(index, 1);
            await updateVaultStorage();
            renderVaultAccounts();
            showToast(getTranslatedText('toastAccountRemoved'));
        }
    });
}

function loadVaultAccount(index) {
    const acc = decryptedVaultAccounts[index];
    document.getElementById('secretInput').value = acc.secret;
    if (acc.algorithm) {
        chooseOption('otpAlgorithmSelect', 'selectedAlgoLabel', acc.algorithm, acc.algorithm === 'SHA-1' ? getTranslatedText('optSha1') : acc.algorithm, 'dropdownMenuAlgo');
    }
    if (acc.digits) {
        chooseOption('otpDigitsSelect', 'selectedDigitsLabel', acc.digits.toString(), getTranslatedText(`opt${acc.digits}Digits`), 'dropdownMenuDigits');
    }
    if (acc.period) {
        chooseOption('otpPeriodSelect', 'selectedPeriodLabel', acc.period.toString(), getTranslatedText(`opt${acc.period}s`), 'dropdownMenuPeriod');
    }
    closeVaultModal();
    generateTokenDirectly();
}

function exportVaultBackupFile() {
    const raw = localStorage.getItem('globalauth_vault');
    if (!raw) return;
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GlobalAuth_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(getTranslatedText('toastBackupExported'));
}

function importVaultBackupFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if (parsed && parsed.ciphertext && parsed.iv && parsed.salt) {
                showModernConfirm({
                    title: getTranslatedText('vaultModalTitle'),
                    desc: "This will restore your database from backup.",
                    onConfirm: () => {
                        localStorage.setItem('globalauth_vault', JSON.stringify(parsed));
                        lockVault();
                        showModernAlert(getTranslatedText('alertNotice'), "Database restored.");
                    }
                });
            }
        } catch (err) {}
    };
    reader.readAsText(file);
    event.target.value = '';
}

/* Multi-Account Dashboard Stream */
function openMultiAccountDashboard() {
    if (!activeMasterPassword || !decryptedVaultAccounts) {
        openVaultModal();
        showModernAlert(getTranslatedText('alertNotice'), getTranslatedText('errEmpty'));
        return;
    }
    document.getElementById('dashboardModal').classList.remove('hidden');
    renderDashboardLiveGrid();
    startDashboardTimer();
}

function closeMultiAccountDashboard() {
    document.getElementById('dashboardModal').classList.add('hidden');
    if (dashboardInterval) clearInterval(dashboardInterval);
}

async function renderDashboardLiveGrid() {
    const container = document.getElementById('dashboardGridContainer');
    if (!decryptedVaultAccounts || decryptedVaultAccounts.length === 0) {
        container.innerHTML = `<div class="col-span-full py-8 text-center text-xs text-slate-400">${getTranslatedText('emptyVaultMsg')}</div>`;
        return;
    }

    container.innerHTML = (await Promise.all(decryptedVaultAccounts.map(async (acc, idx) => {
        const period = parseInt(acc.period || '30', 10);
        const digits = parseInt(acc.digits || '6', 10);
        const algo = acc.algorithm || 'SHA-1';
        const code = await generateTOTP(acc.secret, period, digits, algo) || '------';
        const brandBadge = getBrandBadge(acc.name);
        let cleanName = acc.name;
        if (cleanName.includes(':')) {
            const parts = cleanName.split(':');
            cleanName = parts[1].trim() || parts[0].trim();
        }

        return `
            <div class="card-inner p-3.5 rounded-xl flex flex-col justify-between space-y-2 border border-slate-200/80 dark:border-slate-800">
                <div class="flex items-center justify-between gap-1">
                    <div class="flex items-center gap-1.5 truncate">
                        ${brandBadge}
                        <span class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">${cleanName}</span>
                    </div>
                    <span class="text-[9px] font-mono px-1 rounded bg-brand-500/10 text-brand-500 font-bold shrink-0">${algo}/${digits}D</span>
                </div>
                <div class="text-center py-1">
                    <span class="font-mono text-2xl font-black tracking-widest text-slate-900 dark:text-white select-all">${code}</span>
                </div>
                <div class="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-800/80">
                    <button onclick="copyExplicit('${code}')" class="text-[11px] font-semibold text-brand-500 hover:text-brand-400">${getTranslatedText('btnCopy')}</button>
                    <button onclick="loadVaultAccount(${idx}); closeMultiAccountDashboard();" class="text-[11px] font-semibold text-slate-400 hover:text-slate-200">${getTranslatedText('btnUse')}</button>
                </div>
            </div>
        `;
    }))).join('');
}

function startDashboardTimer() {
    if (dashboardInterval) clearInterval(dashboardInterval);
    const progressBar = document.getElementById('dashboardGlobalProgress');
    const badge = document.getElementById('dashboardTimerBadge');

    dashboardInterval = setInterval(async () => {
        const epoch = 30;
        const now = Math.floor(Date.now() / 1000);
        const left = epoch - (now % epoch);
        const pct = (left / epoch) * 100;
        
        progressBar.style.width = `${pct}%`;
        badge.innerText = left + 's';

        if (left === epoch) {
            renderDashboardLiveGrid();
        }
    }, 1000);
}

function copyExplicit(code) {
    if (code && !code.includes('-')) {
        navigator.clipboard.writeText(code);
        showToast(getTranslatedText('toastMsg'));
    }
}

/* TOTP RFC 6238 Engine */
function getSecretBytes(secret) {
    const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let cleaned = secret.replace(/=+$/, '').toUpperCase().replace(/0/g, 'O').replace(/1/g, 'I');
    let bits = "";
    for (let i = 0; i < cleaned.length; i++) {
        let char = cleaned.charAt(i);
        let val = base32Chars.indexOf(char);
        if (val === -1) continue;
        bits += val.toString(2).padStart(5, '0');
    }
    let bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.substr(i, 8), 2));
    }
    return bytes.length === 0 ? new TextEncoder().encode(secret) : new Uint8Array(bytes);
}

async function generateTOTP(secret, epoch = 30, digits = 6, algo = "SHA-1") {
    try {
        const bytes = getSecretBytes(secret);
        if (bytes.length === 0) return null;

        const time = Math.floor(Date.now() / 1000);
        const counter = Math.floor(time / epoch);
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        view.setUint32(4, counter, false);

        const cryptoKey = await window.crypto.subtle.importKey(
            "raw", bytes, { name: "HMAC", hash: { name: algo } }, false, ["sign"]
        );
        const signature = await window.crypto.subtle.sign("HMAC", cryptoKey, buffer);
        const hmac = new Uint8Array(signature);
        const offset = hmac[hmac.length - 1] & 0x0f;
        const binary = 
            ((hmac[offset] & 0x7f) << 24) |
            ((hmac[offset + 1] & 0xff) << 16) |
            ((hmac[offset + 2] & 0xff) << 8) |
            (hmac[offset + 3] & 0xff);

        return (binary % Math.pow(10, digits)).toString().padStart(digits, '0');
    } catch (e) {
        return null;
    }
}

/* 2-Second Verification Animation with Scramble Decoding */
async function generateTokenWithDelay() {
    const secret = getSanitizedSecret();
    if (!secret) {
        showModernAlert(getTranslatedText('alertNotice'), getTranslatedText('errEmpty'));
        return;
    }

    const btn = document.getElementById('genBtn');
    const btnText = document.getElementById('genBtnText');
    const progressBar = document.getElementById('genProgressBar');
    const codeEl = document.getElementById('resultCode');
    const digits = parseInt(document.getElementById('otpDigitsSelect').value, 10);

    btn.disabled = true;
    btn.style.opacity = '0.92';
    btn.style.pointerEvents = 'none';

    progressBar.style.transition = 'none';
    progressBar.style.width = '0%';
    void progressBar.offsetWidth;
    progressBar.style.transition = 'width 2s cubic-bezier(0.16, 1, 0.3, 1)';
    progressBar.style.width = '100%';

    btnText.innerHTML = `
        <svg class="w-4 h-4 animate-spin text-cyan-300" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <span>Generating...</span>
    `;

    codeEl.className = 'text-3xl sm:text-4xl lg:text-[40px] font-mono font-black tracking-[0.14em] cursor-pointer select-all drop-shadow-sm min-h-[48px] flex items-center justify-center token-decoding';
    
    const matrixChars = "0123456789ABCDEF";
    if (cipherScrambleInterval) clearInterval(cipherScrambleInterval);
    
    cipherScrambleInterval = setInterval(() => {
        let scrambled = "";
        for (let i = 0; i < digits; i++) {
            scrambled += matrixChars[Math.floor(Math.random() * matrixChars.length)];
        }
        codeEl.innerText = scrambled;
    }, 60);

    setTimeout(async () => {
        if (cipherScrambleInterval) clearInterval(cipherScrambleInterval);
        await generateTokenDirectly();
        
        progressBar.style.width = '0%';
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';

        btnText.innerHTML = `
            <svg class="w-4 h-4 text-cyan-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            <span data-i18n="btnGen">${getTranslatedText('btnGen')}</span>
        `;
    }, 2000);
}

/* Instant Token Generation */
async function generateTokenDirectly() {
    const secret = getSanitizedSecret();
    if (!secret) return;

    const digits = parseInt(document.getElementById('otpDigitsSelect').value, 10);
    const algo = document.getElementById('otpAlgorithmSelect').value;
    const period = parseInt(document.getElementById('otpPeriodSelect').value, 10);

    const token = await generateTOTP(secret, period, digits, algo);
    const codeEl = document.getElementById('resultCode');

    if (!token) {
        codeEl.innerText = "-".repeat(digits);
        codeEl.className = 'text-3xl sm:text-4xl lg:text-[40px] font-mono font-black tracking-[0.14em] text-slate-900 dark:text-white cursor-pointer select-all drop-shadow-sm min-h-[48px] flex items-center justify-center';
        showModernAlert(getTranslatedText('alertNotice'), getTranslatedText('errFormat'));
        return;
    }

    currentActiveSecret = secret;
    
    codeEl.className = 'text-3xl sm:text-4xl lg:text-[40px] font-mono font-black tracking-[0.14em] text-slate-900 dark:text-white cursor-pointer select-all drop-shadow-sm min-h-[48px] flex items-center justify-center token-revealed';
    codeEl.innerText = token;

    document.getElementById('verifiedStatusBadge').classList.remove('hidden');

    const laser = document.getElementById('laserScanner');
    laser.classList.remove('laser-active');
    void laser.offsetWidth;
    laser.classList.add('laser-active');

    let gens = parseInt(localStorage.getItem('stat_generations') || '0', 10);
    localStorage.setItem('stat_generations', (gens + 1).toString());

    sessionHistory.unshift({
        token: token,
        time: new Date().toLocaleTimeString(),
        meta: `${algo} • ${digits}D`
    });
    renderHistoryList();
    startTimer();
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    const progressBar = document.getElementById('progressBar');
    const timerText = document.getElementById('timerText');

    timerInterval = setInterval(async () => {
        const epoch = parseInt(document.getElementById('otpPeriodSelect').value, 10);
        const digits = parseInt(document.getElementById('otpDigitsSelect').value, 10);
        const algo = document.getElementById('otpAlgorithmSelect').value;

        const timeNow = Math.floor(Date.now() / 1000);
        const currentLeft = epoch - (timeNow % epoch);
        const percent = (currentLeft / epoch) * 100;
        
        progressBar.style.width = `${percent}%`;
        timerText.innerText = currentLeft + 's';

        if (currentLeft === epoch && currentActiveSecret) {
            const newToken = await generateTOTP(currentActiveSecret, epoch, digits, algo);
            if (newToken) {
                const codeEl = document.getElementById('resultCode');
                codeEl.classList.remove('token-revealed');
                void codeEl.offsetWidth;
                codeEl.classList.add('token-revealed');
                codeEl.innerText = newToken;
            }
        }
    }, 1000);
}

/* History Operations */
function renderHistoryList(term = '') {
    const list = document.getElementById('historyList');
    const filtered = sessionHistory.filter(item => 
        item.token.toLowerCase().includes(term.toLowerCase()) || 
        item.meta.toLowerCase().includes(term.toLowerCase())
    );

    if (filtered.length === 0) {
        list.innerHTML = `<li class="text-xs text-slate-400 italic py-1 text-center">${getTranslatedText('noHistory')}</li>`;
        return;
    }

    list.innerHTML = filtered.map((item, idx) => `
        <li class="flex items-center justify-between py-1.5 border-b border-slate-200/40 dark:border-slate-800/40 last:border-0 ${idx === 0 ? 'animate-history-pop' : ''}">
            <div class="flex items-center gap-1.5">
                <span class="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">${item.token}</span>
                <span class="text-[9px] font-mono px-1 rounded bg-brand-500/10 text-brand-500 font-semibold">${item.meta}</span>
            </div>
            <span class="text-[10px] text-slate-400 font-mono">${item.time}</span>
        </li>
    `).join('');
}

function filterHistoryList() {
    renderHistoryList(document.getElementById('historySearchInput').value);
}

function clearHistoryEntries() {
    sessionHistory = [];
    document.getElementById('historySearchInput').value = '';
    renderHistoryList();
    showToast(getTranslatedText('toastHistoryCleared'));
}

/* Clipboard Copy Hook */
document.getElementById('copyBtn').addEventListener('click', () => {
    const code = document.getElementById('resultCode').innerText;
    if (code && !code.includes('-')) {
        navigator.clipboard.writeText(code);
        showToast(getTranslatedText('toastMsg'));

        const btn = document.getElementById('copyBtn');
        const textSpan = document.getElementById('copyText');
        const iconSvg = document.getElementById('copyIcon');

        btn.classList.add('bg-emerald-500/15', 'text-emerald-600', 'dark:text-emerald-400', 'border-emerald-500/30');
        iconSvg.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>`;
        textSpan.innerText = getTranslatedText('toastCopiedMorphed');

        setTimeout(() => {
            btn.classList.remove('bg-emerald-500/15', 'text-emerald-600', 'dark:text-emerald-400', 'border-emerald-500/30');
            iconSvg.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>`;
            textSpan.innerText = getTranslatedText('btnCopy');
        }, 2000);
    }
});

/* URI Detection Helper */
function parseSecretUriParams() {
    const rawVal = document.getElementById('secretInput').value.trim();
    if (rawVal.toUpperCase().startsWith('OTPAUTH://')) {
        try {
            const url = new URL(rawVal);
            const algo = url.searchParams.get('algorithm');
            const digits = url.searchParams.get('digits');
            const period = url.searchParams.get('period');

            if (algo) {
                const nAlgo = algo.toUpperCase();
                if (['SHA-1', 'SHA-256', 'SHA-512'].includes(nAlgo)) {
                    chooseOption('otpAlgorithmSelect', 'selectedAlgoLabel', nAlgo, nAlgo === 'SHA-1' ? getTranslatedText('optSha1') : nAlgo, 'dropdownMenuAlgo');
                }
            }
            if (digits && ['6', '7', '8'].includes(digits)) {
                chooseOption('otpDigitsSelect', 'selectedDigitsLabel', digits, getTranslatedText(`opt${digits}Digits`), 'dropdownMenuDigits');
            }
            if (period && ['30', '60'].includes(period)) {
                chooseOption('otpPeriodSelect', 'selectedPeriodLabel', period, getTranslatedText(`opt${period}s`), 'dropdownMenuPeriod');
            }
        } catch (e) {}
    }
}

function getSanitizedSecret() {
    let rawVal = document.getElementById('secretInput').value.trim();
    if (!rawVal) return '';
    let cleaned = rawVal.replace(/\s+/g, '').toUpperCase();
    if (cleaned.startsWith('OTPAUTH://')) {
        try {
            const url = new URL(rawVal);
            const secretParam = url.searchParams.get('secret');
            if (secretParam) cleaned = secretParam.replace(/\s+/g, '').toUpperCase();
        } catch (e) {
            const match = rawVal.match(/[?&]secret=([A-Z2-7=+]+)/i);
            if (match && match[1]) cleaned = match[1].replace(/=+$/, '').toUpperCase();
        }
    }
    return cleaned.replace(/=+$/, '');
}

/* Camera Scanner Operations */
async function startCameraScanner() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } }
        });
        video.srcObject = cameraStream;
        video.setAttribute('playsinline', 'true');
        video.play();
        modal.classList.remove('hidden');

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        function tick() {
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imgData.data, canvas.width, canvas.height);
                if (code && code.data) {
                    document.getElementById('secretInput').value = code.data;
                    parseSecretUriParams();
                    stopCameraScanner();
                    showToast(getTranslatedText('toastQrDetected'));
                    generateTokenWithDelay();
                    return;
                }
            }
            cameraAnimationId = requestAnimationFrame(tick);
        }
        cameraAnimationId = requestAnimationFrame(tick);
    } catch (err) {
        showModernAlert(getTranslatedText('alertNotice'), getTranslatedText('errCameraAccess'));
    }
}

function stopCameraScanner() {
    if (cameraAnimationId) cancelAnimationFrame(cameraAnimationId);
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
    document.getElementById('cameraModal').classList.add('hidden');
}

/* Upload QR Code Image */
function handleQRCodeUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d', { willReadFrequently: true });
            let width = img.width;
            let height = img.height;
            const maxDim = 1000;
            if (width > maxDim || height > maxDim) {
                if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
                else { width = Math.round((width * maxDim) / height); height = maxDim; }
            }
            canvas.width = width; canvas.height = height;
            context.drawImage(img, 0, 0, width, height);
            const imgData = context.getImageData(0, 0, width, height);
            const code = jsQR(imgData.data, width, height);
            if (code) {
                document.getElementById('secretInput').value = code.data;
                parseSecretUriParams();
                showToast(getTranslatedText('toastQrDetected'));
                generateTokenWithDelay();
            } else {
                showModernAlert(getTranslatedText('alertNotice'), getTranslatedText('errScanFailed'));
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

/* Keyboard System Hooks */
window.addEventListener('keydown', (e) => {
    const tag = document.activeElement.tagName.toLowerCase();
    const isTyping = tag === 'input' || tag === 'textarea';

    if (e.key === 'Escape') {
        closeVaultModal();
        closeMultiAccountDashboard();
        closeModernAlert();
        closeModernPrompt();
        closeModernConfirm();
        closeAdminPasswordModal();
        closeAdminPanel();
        closeNotesModal();
        stopCameraScanner();
        closeAllCustomDropdowns();
        const drawer = document.getElementById('mobileDrawer');
        const backdrop = document.getElementById('mobileDrawerBackdrop');
        if (drawer && !drawer.classList.contains('translate-x-full')) {
            drawer.classList.add('translate-x-full');
            if (backdrop) backdrop.classList.add('opacity-0');
            setTimeout(() => backdrop && backdrop.classList.add('hidden'), 300);
        }
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !isTyping) {
        const code = document.getElementById('resultCode').innerText;
        if (code && !code.includes('-')) {
            navigator.clipboard.writeText(code);
            showToast(getTranslatedText('toastMsg'));
        }
    }

    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'b') && !isTyping) {
        e.preventDefault();
        openVaultModal();
    }
});

/* Modal Trigger Engine */
let promptCallback = null;
function showModernPrompt({ title, defaultValue = '', onConfirm }) {
    document.getElementById('promptTitle').innerText = title || getTranslatedText('promptAccountLabel');
    const input = document.getElementById('promptInput');
    input.value = defaultValue;
    promptCallback = onConfirm;
    document.getElementById('modernPromptModal').classList.remove('hidden');
    setTimeout(() => { input.focus(); input.select(); }, 50);
}
function closeModernPrompt() {
    document.getElementById('modernPromptModal').classList.add('hidden');
    promptCallback = null;
}
document.getElementById('promptConfirmBtn').addEventListener('click', () => {
    if (promptCallback) promptCallback(document.getElementById('promptInput').value);
    closeModernPrompt();
});

let confirmCallback = null;
function showModernConfirm({ title, desc, onConfirm }) {
    document.getElementById('confirmTitle').innerText = title || getTranslatedText('confirmDeleteTitle');
    document.getElementById('confirmDesc').innerText = desc || getTranslatedText('confirmDeleteDesc');
    confirmCallback = onConfirm;
    document.getElementById('modernConfirmModal').classList.remove('hidden');
}
function closeModernConfirm() {
    document.getElementById('modernConfirmModal').classList.add('hidden');
    confirmCallback = null;
}
document.getElementById('confirmActionBtn').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeModernConfirm();
});

function showModernAlert(title, message) {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMessage').innerText = message;
    document.getElementById('modernAlertModal').classList.remove('hidden');
}
function closeModernAlert() {
    document.getElementById('modernAlertModal').classList.add('hidden');
}

function showToast(text) {
    const toast = document.getElementById('toastNotification');
    document.getElementById('toastText').innerText = text;
    toast.classList.remove('hidden');
    requestAnimationFrame(() => { toast.classList.remove('opacity-0'); });
    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.classList.add('hidden'), 200);
    }, 1800);
}

/* Event Badges */
function getActionBadge(action) {
    const act = (action || '').toLowerCase();
    if (act.includes('unlock')) {
        return `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Unlocked Vault
        </span>`;
    } else if (act.includes('password') || act.includes('created') || act.includes('init')) {
        return `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Master Auth
        </span>`;
    } else {
        return `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-sky-500"></span> Page Visit
        </span>`;
    }
}

/* Telemetry Stats Display */
function fetchAdminStats(searchTerm = '') {
    document.getElementById('statVisitors').innerText = localStorage.getItem('stat_visitors') || '1';
    document.getElementById('statGenerations').innerText = localStorage.getItem('stat_generations') || '0';
    
    const container = document.getElementById('adminLogsList');
    const logs = JSON.parse(localStorage.getItem('admin_ip_logs') || '[]');

    const filtered = logs.filter(log => 
        (log.ip || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.countryName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.countryCode || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filtered.length === 0) {
        container.innerHTML = `<div class="card-inner p-4 text-center text-xs text-slate-400 italic rounded-xl">No telemetry matching query</div>`;
        return;
    }

    container.innerHTML = filtered.map(log => {
        const flagEl = getCountryFlagElement(log.countryCode);
        const region = log.countryCode && log.countryCode !== 'UN' ? log.countryCode : '';

        return `
            <div class="grid grid-cols-12 items-center px-4 py-2 rounded-xl card-inner border border-slate-200/60 dark:border-slate-800/80 hover:border-brand-500/40 transition-colors group shadow-sm">
                <div class="col-span-5 flex items-center gap-2 min-w-0 pr-2">
                    ${flagEl}
                    <span class="font-bold text-brand-600 dark:text-brand-400 tracking-tight truncate">${log.ip}</span>
                    ${region ? `<span class="text-[9px] font-mono px-1 rounded bg-slate-500/10 text-slate-500 dark:text-slate-400 font-bold shrink-0">${region}</span>` : ''}
                    <button onclick="copyExplicit('${log.ip}')" class="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-brand-500 text-xs shrink-0" title="Copy IP">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                    </button>
                </div>

                <div class="col-span-4 flex items-center">
                    ${getActionBadge(log.action)}
                </div>

                <div class="col-span-3 text-right text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    ${log.time}
                </div>
            </div>
        `;
    }).join('');
}

function filterAdminLogs() {
    const val = document.getElementById('adminLogSearchInput')?.value || '';
    fetchAdminStats(val);
}

function clearAdminLogs() {
    showModernConfirm({
        title: "Clear IP Audit Logs?",
        desc: "All stored telemetry logs will be permanently deleted from local cache.",
        onConfirm: () => {
            localStorage.removeItem('admin_ip_logs');
            fetchAdminStats();
            showToast("Audit logs cleared.");
        }
    });
}

function openAdminPasswordModal() {
    document.getElementById('adminPinInput').value = '';
    document.getElementById('adminPasswordError').classList.add('hidden');
    document.getElementById('adminPasswordModal').classList.remove('hidden');
    document.getElementById('adminPinInput').focus();
}

function closeAdminPasswordModal() { 
    document.getElementById('adminPasswordModal').classList.add('hidden'); 
}

/* Secure Admin Authentication Request */
async function verifyAdminPasscode() {
    const pin = document.getElementById('adminPinInput').value;
    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passcode: pin })
        });
        const resData = await response.json();
        if (resData && resData.success) {
            closeAdminPasswordModal();
            document.getElementById('adminModal').classList.remove('hidden');
            fetchAdminStats();
            return;
        }
    } catch (e) {
        // Fallback check if working purely statically
        if (pin === "171204") {
            closeAdminPasswordModal();
            document.getElementById('adminModal').classList.remove('hidden');
            fetchAdminStats();
            return;
        }
    }
    document.getElementById('adminPasswordError').classList.remove('hidden');
}

function closeAdminPanel() { 
    document.getElementById('adminModal').classList.add('hidden'); 
}

/* Theme Management */
function updateThemeClasses() {
    const iconSun = document.getElementById('icon-sun');
    const iconMoon = document.getElementById('icon-moon');
    if (currentTheme === 'dark') {
        document.documentElement.classList.add('dark');
        document.getElementById('bodyRoot').className = "bg-mesh-dark text-slate-100 min-h-screen flex flex-col transition-colors duration-300 overflow-x-hidden selection:bg-brand-500/20 selection:text-brand-500";
        iconSun?.classList.remove('hidden');
        iconMoon?.classList.add('hidden');
    } else {
        document.documentElement.classList.remove('dark');
        document.getElementById('bodyRoot').className = "bg-mesh-light text-slate-800 min-h-screen flex flex-col transition-colors duration-300 overflow-x-hidden selection:bg-brand-500/20 selection:text-brand-500";
        iconMoon?.classList.remove('hidden');
        iconSun?.classList.add('hidden');
    }
}
updateThemeClasses();

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', currentTheme);
    updateThemeClasses();
}

/* Language Selection Handling */
function toggleLanguage() {
    if (currentLang === 'en') {
        currentLang = 'km';
        document.getElementById('langText').innerText = 'ខ្មែរ';
        document.getElementById('langTextMobile').innerText = 'ខ្មែរ';
    } else if (currentLang === 'km') {
        currentLang = 'zh';
        document.getElementById('langText').innerText = '中文';
        document.getElementById('langTextMobile').innerText = '中文';
    } else {
        currentLang = 'en';
        document.getElementById('langText').innerText = 'EN';
        document.getElementById('langTextMobile').innerText = 'EN';
    }
    
    document.getElementById('htmlRoot').setAttribute('lang', currentLang);

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang] && translations[currentLang][key]) {
            el.innerText = translations[currentLang][key];
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[currentLang] && translations[currentLang][key]) {
            el.setAttribute('placeholder', translations[currentLang][key]);
        }
    });

    const algoVal = document.getElementById('otpAlgorithmSelect').value;
    document.getElementById('selectedAlgoLabel').innerText = algoVal === 'SHA-1' ? getTranslatedText('optSha1') : algoVal;
    
    const digitsVal = document.getElementById('otpDigitsSelect').value;
    document.getElementById('selectedDigitsLabel').innerText = getTranslatedText(`opt${digitsVal}Digits`);
    
    const periodVal = document.getElementById('otpPeriodSelect').value;
    document.getElementById('selectedPeriodLabel').innerText = getTranslatedText(`opt${periodVal}s`);

    renderNotesContent();
    renderVaultAccounts();
    renderHistoryList();
}

/* Offline PWA Service Worker Registration */
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
        const swCode = `
            const CACHE_NAME = 'globalauth-cache-v4';
            self.addEventListener('install', e => self.skipWaiting());
            self.addEventListener('activate', e => e.waitUntil(clients.claim()));
            self.addEventListener('fetch', e => {
                if (e.request.method !== 'GET') return;
                e.respondWith(
                    fetch(e.request).then(res => {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                        return res;
                    }).catch(() => caches.match(e.request))
                );
            });
        `;
        const blob = new Blob([swCode], { type: 'application/javascript' });
        navigator.serviceWorker.register(URL.createObjectURL(blob)).catch(() => {});
    });
}