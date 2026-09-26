// ==UserScript==
// @name         Roblox Auto Unfriend & GUI
// @namespace    http://tampermonkey.net/
// @version      5.1
// @description  Unfriend history with display names + profile button
// @match        *://www.roblox.com/*friends*
// @match        *://web.roblox.com/*friends*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let csrfToken = null;
    let selectedUserIds = new Set();
    let unfriendedHistory = JSON.parse(localStorage.getItem('nebula_unfriended') || '[]');
    let isDark = localStorage.getItem('nebula_dark') === '1';
    let isMinimized = localStorage.getItem('nebula_minimized') === '1';
    let lastOrderKey = '';
    let refreshTimer = null;
    let friendCache = [];
    let knownFriends = new Map();
    let gui = null;
    let miniBtn = null;

    function getPageType() {
        const hash = (location.hash || '').toLowerCase();
        const href = (location.href || '').toLowerCase();

        if (hash.includes('friend-requests') || href.includes('friend-requests')) return 'requests';
        if (hash.includes('following') || href.includes('#!/following')) return 'following';
        if (hash.includes('followers') || href.includes('#!/followers')) return 'followers';

        if (hash === '' || hash === '#' || hash === '#!/friends' || hash.includes('#!/friends') || hash === '#friends') {
            return 'friends';
        }

        const active = document.querySelector('.rbx-tab-active, [class*="tab"][class*="active"], .nav-link.active');
        if (active) {
            const t = active.textContent.toLowerCase();
            if (t.includes('request')) return 'requests';
            if (t.includes('following')) return 'following';
            if (t.includes('follower')) return 'followers';
            if (t.includes('friend')) return 'friends';
        }
        return 'friends';
    }

    function isOnFriendsTab() {
        return getPageType() === 'friends';
    }

    function createGUI() {
        if (gui) return;

        gui = document.createElement('div');
        gui.id = 'sym-gui';
        Object.assign(gui.style, {
            position: 'fixed',
            top: '90px',
            right: '25px',
            width: '360px',
            maxHeight: '88vh',
            borderRadius: '16px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
            zIndex: '99999',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
            userSelect: 'none',
            transition: 'background 0.2s, color 0.2s'
        });

        applyTheme();

        gui.innerHTML = `
            <div id="gui-header" style="padding:12px 14px;border-bottom:1px solid ${isDark ? '#333' : '#e0e0e0'};display:flex;justify-content:space-between;align-items:center;cursor:move;">
                <div style="font-weight:700;font-size:15px;">Roblox Unfriend</div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span id="sym-count-label" style="font-size:13px;opacity:0.8;font-weight:600;">Selected 0</span>
                    <span id="theme-toggle" style="cursor:pointer;font-size:16px;" title="Toggle dark mode">🌙</span>
                    <span id="minimize-btn" style="cursor:pointer;font-size:18px;font-weight:700;line-height:1;padding:0 4px;" title="Minimize">–</span>
                </div>
            </div>

            <div style="padding:10px 12px;display:flex;gap:8px;flex-wrap:wrap;">
                <button id="delete-btn" style="flex:1;min-width:100px;padding:9px;border:none;border-radius:10px;background:#ff4d4d;color:#fff;font-weight:700;cursor:pointer;">Delete Selected</button>
                <button id="clear-sel-btn" style="padding:9px 12px;border:none;border-radius:10px;background:#666;color:#fff;font-weight:600;cursor:pointer;">Clear</button>
                <button id="refresh-btn" style="padding:9px 12px;border:none;border-radius:10px;background:#2196f3;color:#fff;font-weight:600;cursor:pointer;">Refresh</button>
            </div>

            <div style="padding:0 14px 4px;font-size:13px;font-weight:600;opacity:0.85;">
                Selected (<span id="selected-count">0</span>)
            </div>
            <div id="selected-log" style="overflow-y:auto;padding:0 8px 8px;max-height:120px;border-bottom:1px solid ${isDark ? '#333' : '#eee'};"></div>

            <div style="padding:8px 14px 4px;font-size:13px;font-weight:600;opacity:0.85;">
                Friends on page (<span id="friend-count">0</span>)
            </div>
            <div id="friends-log" style="flex:1;overflow-y:auto;padding:0 8px 10px;min-height:150px;max-height:260px;"></div>

            <div style="padding:8px 14px 4px;font-size:13px;font-weight:600;opacity:0.85;display:flex;justify-content:space-between;align-items:center;border-top:1px solid ${isDark ? '#333' : '#eee'};">
                <span>Unfriended History</span>
                <button id="clear-history-btn" style="font-size:11px;padding:2px 7px;border:none;border-radius:6px;background:#555;color:#fff;cursor:pointer;">Clear</button>
            </div>
            <div id="unfriended-log" style="overflow-y:auto;padding:0 8px 12px;max-height:140px;"></div>
        `;

        document.body.appendChild(gui);
        bindGUIEvents();
        updateMinimizeState();
    }

    function createMiniButton() {
        if (miniBtn) return;

        miniBtn = document.createElement('div');
        miniBtn.id = 'sym-mini';
        Object.assign(miniBtn.style, {
            position: 'fixed',
            top: '90px',
            right: '25px',
            padding: '10px 16px',
            background: isDark ? '#1e1e1e' : '#ffffff',
            color: isDark ? '#e0e0e0' : '#111',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: '99999',
            cursor: 'move',
            fontWeight: '700',
            fontSize: '14px',
            fontFamily: 'system-ui, sans-serif',
            display: 'none',
            userSelect: 'none'
        });
        miniBtn.textContent = 'Unfriend';
        miniBtn.title = 'Click to expand • Drag to move';

        miniBtn.addEventListener('click', (e) => {
            if (miniBtn.dataset.dragging === '1') return;
            isMinimized = false;
            localStorage.setItem('nebula_minimized', '0');
            updateMinimizeState();
        });

        let isDragging = false, startX, startY, initRight, initTop;
        miniBtn.addEventListener('mousedown', (e) => {
            isDragging = true;
            miniBtn.dataset.dragging = '0';
            startX = e.clientX;
            startY = e.clientY;
            const rect = miniBtn.getBoundingClientRect();
            initRight = window.innerWidth - rect.right;
            initTop = rect.top;
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) miniBtn.dataset.dragging = '1';
            miniBtn.style.right = (initRight - dx) + 'px';
            miniBtn.style.top = (initTop + dy) + 'px';
        });
        document.addEventListener('mouseup', () => {
            isDragging = false;
            setTimeout(() => { if (miniBtn) miniBtn.dataset.dragging = '0'; }, 50);
        });

        document.body.appendChild(miniBtn);
    }

    function updateMinimizeState() {
        if (!gui) return;
        if (isMinimized) {
            gui.style.display = 'none';
            if (miniBtn) miniBtn.style.display = 'block';
        } else {
            gui.style.display = 'flex';
            if (miniBtn) miniBtn.style.display = 'none';
        }
    }

    function applyTheme() {
        if (!gui) return;
        if (isDark) {
            gui.style.background = '#1e1e1e';
            gui.style.color = '#e0e0e0';
        } else {
            gui.style.background = '#ffffff';
            gui.style.color = '#111111';
        }
        const moon = document.getElementById('theme-toggle');
        if (moon) moon.textContent = isDark ? '☀️' : '🌙';
        if (miniBtn) {
            miniBtn.style.background = isDark ? '#1e1e1e' : '#ffffff';
            miniBtn.style.color = isDark ? '#e0e0e0' : '#111';
        }
    }

    function playSound(url) {
        const a = new Audio(url);
        a.volume = 0.4;
        a.play().catch(() => {});
    }

    function updateSelectedCount() {
        const lbl = document.getElementById('sym-count-label');
        const selCount = document.getElementById('selected-count');
        if (lbl) lbl.textContent = `Selected ${selectedUserIds.size}`;
        if (selCount) selCount.textContent = selectedUserIds.size;
    }

    function getAvatarUrl(userId, existing) {
        if (existing && existing.startsWith('http') && !existing.includes('nophoto')) return existing;
        return `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=48&height=48&format=png`;
    }

    function isPlaceholderName(name) {
        if (!name) return true;
        const n = String(name).trim().toLowerCase();
        if (n === '') return true;
        if (n === 'unavailable') return true;
        if (/^user \d+$/.test(n)) return true;
        return false;
    }

    function mergeKnownFriend(data) {
        if (!data || !data.id) return;
        const existing = knownFriends.get(data.id);
        if (!existing) {
            knownFriends.set(data.id, data);
            return;
        }
        const incomingIsGood = !isPlaceholderName(data.displayName);
        const usernameIsGood = data.username && !isPlaceholderName(data.username);
        knownFriends.set(data.id, {
            id: data.id,
            displayName: incomingIsGood ? data.displayName : existing.displayName,
            username: usernameIsGood ? data.username : existing.username,
            avatar: data.avatar || existing.avatar
        });
    }

    function extractFriendData(card) {
        const text = (card.textContent || '').toLowerCase();
        if (text.includes('accept') || text.includes('ignore')) return null;

        let id = null;
        const idAttr = card.getAttribute('id') || card.getAttribute('data-userid') || card.getAttribute('data-user-id') || '';
        if (/^\d+$/.test(idAttr)) id = idAttr;
        if (!id) {
            const link = card.querySelector('a[href*="/users/"]');
            if (link) {
                const m = link.href.match(/\/users\/(\d+)/);
                if (m) id = m[1];
            }
        }
        if (!id) return null;

        let displayName = '';
        let username = '';

        const links = card.querySelectorAll('a[href*="/users/"]');
        for (const link of links) {
            const t = link.textContent.trim();
            if (!t) continue;
            if (t.startsWith('@')) {
                username = t.slice(1);
            } else if (!displayName) {
                displayName = t;
            }
        }

        if (!username) {
            const els = card.querySelectorAll('span, div, p');
            for (const el of els) {
                const t = (el.textContent || '').trim();
                if (t.startsWith('@') && t.length > 1 && t.length < 40) {
                    username = t.slice(1);
                    break;
                }
            }
        }

        if (!displayName) displayName = username || `User ${id}`;
        if (!username) username = displayName;

        let avatar = '';
        const img = card.querySelector('img');
        if (img) {
            avatar = img.src || img.currentSrc || img.getAttribute('data-src') || '';
            if (!avatar && img.srcset) {
                const parts = img.srcset.split(',');
                if (parts.length) avatar = parts[parts.length - 1].trim().split(' ')[0];
            }
        }

        return { id: String(id), displayName, username, avatar };
    }

    function getFriendsFromPage() {
        if (!isOnFriendsTab()) return [];

        const cards = document.querySelectorAll('.avatar-card, .friend-card, [class*="FriendCard"], [class*="avatar-card"]');
        const friends = [];
        const seen = new Set();

        cards.forEach(card => {
            const data = extractFriendData(card);
            if (!data || seen.has(data.id)) return;
            seen.add(data.id);
            friends.push(data);
            mergeKnownFriend(data);
        });

        return friends;
    }

    function findCardById(userId) {
        if (!isOnFriendsTab()) return null;
        const cards = document.querySelectorAll('.avatar-card, .friend-card, [class*="FriendCard"], [class*="avatar-card"]');
        for (const card of cards) {
            const data = extractFriendData(card);
            if (data && data.id === userId) return card;
        }
        return null;
    }

    function renderSelectedLog() {
        const container = document.getElementById('selected-log');
        if (!container) return;

        if (selectedUserIds.size === 0) {
            container.innerHTML = `<div style="padding:6px 4px;opacity:0.55;font-size:12px;">None selected</div>`;
            return;
        }

        const selectedFriends = [...selectedUserIds].map(id => {
            return knownFriends.get(id) || { id, displayName: `User ${id}`, username: id, avatar: '' };
        });

        const bg = isDark ? '#2a2a2a' : '#f0f0f0';

        container.innerHTML = selectedFriends.map(f => `
            <div style="display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:8px;margin-bottom:3px;background:${bg};">
                <img src="${getAvatarUrl(f.id, f.avatar)}"
                     style="width:28px;height:28px;border-radius:50%;object-fit:cover;background:#444;"
                     onerror="this.src='https://www.roblox.com/images/icons/avatar_nophoto.png'">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.displayName}</div>
                    <div style="font-size:10px;opacity:0.7;">@${f.username} • ${f.id}</div>
                </div>
                <div class="deselect-btn" data-id="${f.id}" style="
                    width:20px;height:20px;border-radius:50%;background:#ff4d4d;color:white;
                    display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;
                    cursor:pointer;flex-shrink:0;line-height:1;
                " title="Remove">–</div>
            </div>
        `).join('');

        container.querySelectorAll('.deselect-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                selectedUserIds.delete(btn.dataset.id);
                updateSelectedCount();
                renderSelectedLog();
                renderFriendsLog(friendCache);
                updatePageButtons();
            };
        });
    }

    function renderFriendsLog(friends) {
        const container = document.getElementById('friends-log');
        if (!container) return;

        const pageType = getPageType();

        if (pageType !== 'friends') {
            const messages = {
                requests: 'You are on the <b>Friend Requests</b> page.<br><br>Please navigate to your <b>Friends</b> list.',
                following: 'You are on the <b>Following</b> page.<br><br>Please navigate to your <b>Friends</b> list.',
                followers: 'You are on the <b>Followers</b> page.<br><br>Please navigate to your <b>Friends</b> list.'
            };
            container.innerHTML = `
                <div style="padding:20px 14px;opacity:0.85;font-size:13px;text-align:center;line-height:1.5;">
                    ${messages[pageType] || 'Please navigate to your <b>Friends</b> list.'}
                </div>`;
            document.getElementById('friend-count').textContent = '0';
            friendCache = [];
            return;
        }

        document.getElementById('friend-count').textContent = friends.length;
        friendCache = friends;

        if (friends.length === 0) {
            container.innerHTML = `<div style="padding:16px;opacity:0.7;font-size:13px;text-align:center;">No friends detected on this page.<br>Scroll down to load more.</div>`;
            return;
        }

        const bgSelected = isDark ? '#1b3d1b' : '#e8f5e9';
        const borderSelected = isDark ? '#2e7d32' : '#a5d6a7';
        const rowBg = isDark ? '#2a2a2a' : '#f7f7f7';

        container.innerHTML = friends.map(f => {
            const isSelected = selectedUserIds.has(f.id);
            return `
                <div class="friend-row" data-id="${f.id}" style="
                    display:flex;align-items:center;gap:10px;padding:8px;border-radius:10px;margin-bottom:5px;
                    background:${isSelected ? bgSelected : rowBg};cursor:pointer;
                    border:1px solid ${isSelected ? borderSelected : 'transparent'};
                ">
                    <div style="
                        width:22px;height:22px;border-radius:5px;border:2px solid ${isSelected ? '#4caf50' : (isDark ? '#666' : '#bbb')};
                        background:${isSelected ? '#4caf50' : 'transparent'};color:white;font-size:13px;font-weight:700;
                        display:flex;align-items:center;justify-content:center;flex-shrink:0;
                    ">${isSelected ? '✓' : ''}</div>
                    <img src="${getAvatarUrl(f.id, f.avatar)}"
                         style="width:36px;height:36px;border-radius:50%;object-fit:cover;background:#444;flex-shrink:0;"
                         onerror="this.src='https://www.roblox.com/images/icons/avatar_nophoto.png'">
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.displayName}</div>
                        <div style="font-size:11px;opacity:0.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">@${f.username} • ${f.id}</div>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.friend-row').forEach(row => {
            row.onclick = (e) => {
                e.stopPropagation();
                const id = row.dataset.id;
                if (selectedUserIds.has(id)) {
                    selectedUserIds.delete(id);
                } else {
                    selectedUserIds.add(id);
                    playSound('https://cdn.pixabay.com/download/audio/2022/03/16/audio_70b3f5b60d.mp3?filename=select-112897.mp3');
                }
                updateSelectedCount();
                renderSelectedLog();
                renderFriendsLog(friendCache);
                updatePageButtons();
            };
        });
    }

    function renderUnfriendedLog() {
        const container = document.getElementById('unfriended-log');
        if (!container) return;

        if (unfriendedHistory.length === 0) {
            container.innerHTML = `<div style="padding:8px;opacity:0.6;font-size:12px;">No one unfriended yet.</div>`;
            return;
        }

        container.innerHTML = unfriendedHistory.slice().reverse().map(f => {
            const name = f.displayName || f.name || `User ${f.id}`;
            const avatar = getAvatarUrl(f.id, f.avatar);
            const timeStr = new Date(f.time).toLocaleString();

            return `
                <div style="display:flex;align-items:center;gap:8px;padding:6px;border-radius:8px;margin-bottom:4px;background:${isDark ? '#3e2c00' : '#fff3e0'};">
                    <img src="${avatar}"
                         style="width:30px;height:30px;border-radius:50%;object-fit:cover;background:#444;flex-shrink:0;"
                         onerror="this.src='https://www.roblox.com/images/icons/avatar_nophoto.png'">
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
                        <div style="font-size:10px;opacity:0.7;">${f.id} • ${timeStr}</div>
                    </div>
                    <a href="https://www.roblox.com/users/${f.id}/profile" target="_blank" rel="noopener"
                       style="
                           padding:4px 8px;border-radius:6px;background:#2196f3;color:white;
                           font-size:11px;font-weight:600;text-decoration:none;flex-shrink:0;
                           white-space:nowrap;
                       " title="Open profile">Profile</a>
                </div>
            `;
        }).join('');
    }

    function updatePageButtons() {
        document.querySelectorAll('.nebula-minus-btn').forEach(el => el.remove());
        if (!isOnFriendsTab() || isMinimized) return;

        friendCache.forEach(f => {
            const card = findCardById(f.id);
            if (!card) return;

            card.style.position = 'relative';
            card.style.overflow = 'visible';

            const btn = document.createElement('div');
            btn.className = 'nebula-minus-btn';
            btn.dataset.id = f.id;
            const isSelected = selectedUserIds.has(f.id);

            Object.assign(btn.style, {
                position: 'absolute',
                top: '6px',
                right: '6px',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: isSelected ? '#ff4d4d' : 'rgba(0,0,0,0.55)',
                color: 'white',
                fontSize: '16px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: '50',
                lineHeight: '1',
                border: isSelected ? '2px solid #ff8a80' : '2px solid rgba(255,255,255,0.4)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                pointerEvents: 'auto'
            });
            btn.textContent = '–';
            btn.title = isSelected ? 'Remove from selection' : 'Add to selection';

            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (selectedUserIds.has(f.id)) {
                    selectedUserIds.delete(f.id);
                } else {
                    selectedUserIds.add(f.id);
                    playSound('https://cdn.pixabay.com/download/audio/2022/03/16/audio_70b3f5b60d.mp3?filename=select-112897.mp3');
                }
                updateSelectedCount();
                renderSelectedLog();
                renderFriendsLog(friendCache);
                updatePageButtons();
            };

            card.appendChild(btn);
        });

        setTimeout(() => {
            if (!isOnFriendsTab() || isMinimized) return;
            friendCache.forEach(f => {
                if (document.querySelector(`.nebula-minus-btn[data-id="${f.id}"]`)) return;
                const card = findCardById(f.id);
                if (!card || card.querySelector('.nebula-minus-btn')) return;

                card.style.position = 'relative';
                card.style.overflow = 'visible';

                const btn = document.createElement('div');
                btn.className = 'nebula-minus-btn';
                btn.dataset.id = f.id;
                const isSelected = selectedUserIds.has(f.id);

                Object.assign(btn.style, {
                    position: 'absolute', top: '6px', right: '6px',
                    width: '22px', height: '22px', borderRadius: '50%',
                    background: isSelected ? '#ff4d4d' : 'rgba(0,0,0,0.55)',
                    color: 'white', fontSize: '16px', fontWeight: '700',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', zIndex: '50', lineHeight: '1',
                    border: isSelected ? '2px solid #ff8a80' : '2px solid rgba(255,255,255,0.4)',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.4)', pointerEvents: 'auto'
                });
                btn.textContent = '–';
                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (selectedUserIds.has(f.id)) selectedUserIds.delete(f.id);
                    else {
                        selectedUserIds.add(f.id);
                        playSound('https://cdn.pixabay.com/download/audio/2022/03/16/audio_70b3f5b60d.mp3?filename=select-112897.mp3');
                    }
                    updateSelectedCount();
                    renderSelectedLog();
                    renderFriendsLog(friendCache);
                    updatePageButtons();
                };
                card.appendChild(btn);
            });
        }, 700);
    }

    async function getCSRFToken() {
        if (csrfToken) return csrfToken;
        try {
            const res = await fetch('https://friends.roblox.com/v1/users/1/unfriend', {
                method: 'POST',
                credentials: 'include'
            });
            csrfToken = res.headers.get('x-csrf-token');
        } catch (e) {}
        return csrfToken;
    }

    async function performUnfriend() {
        if (selectedUserIds.size === 0) {
            alert('No users selected.');
            return;
        }
        if (!confirm(`Unfriend ${selectedUserIds.size} selected user(s)?`)) return;

        const selected = [...selectedUserIds];
        await getCSRFToken();

        const successfullyRemoved = [];
        const failed = [];

        for (const userId of selected) {
            try {
                const res = await fetch(`https://friends.roblox.com/v1/users/${userId}/unfriend`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'x-csrf-token': csrfToken }
                });

                if (res.ok) {
                    const friend = knownFriends.get(userId) || friendCache.find(f => f.id === userId);
                    successfullyRemoved.push({
                        id: userId,
                        displayName: friend ? friend.displayName : `User ${userId}`,
                        name: friend ? friend.displayName : `User ${userId}`,
                        username: friend ? friend.username : userId,
                        avatar: friend ? friend.avatar : '',
                        time: Date.now()
                    });
                    playSound('https://cdn.pixabay.com/download/audio/2022/03/15/audio_8d27587046.mp3?filename=click-124467.mp3');
                } else {
                    failed.push(userId);
                }
            } catch (err) {
                failed.push(userId);
            }
            await new Promise(r => setTimeout(r, 450));
        }

        if (successfullyRemoved.length) {
            unfriendedHistory = unfriendedHistory.concat(successfullyRemoved);
            if (unfriendedHistory.length > 200) unfriendedHistory = unfriendedHistory.slice(-200);
            localStorage.setItem('nebula_unfriended', JSON.stringify(unfriendedHistory));
            renderUnfriendedLog();
        }

        selectedUserIds.clear();
        updateSelectedCount();
        renderSelectedLog();

        setTimeout(() => {
            lastOrderKey = '';
            refreshFromPage();
            alert(`Finished.\nUnfriended: ${successfullyRemoved.length}\nFailed: ${failed.length}`);
        }, 1200);
    }

    function refreshFromPage() {
        createGUI();
        createMiniButton();

        const rawFriends = getFriendsFromPage();
        const friends = rawFriends.map(f => knownFriends.get(f.id) || f);

        const orderKey = friends.map(f => `${f.id}:${f.displayName}:${f.avatar ? 1 : 0}`).join(',') + '|' + getPageType();

        if (orderKey !== lastOrderKey) {
            lastOrderKey = orderKey;
            renderFriendsLog(friends);
            renderSelectedLog();
        }
        updatePageButtons();
        updateMinimizeState();
        applyTheme();
        renderUnfriendedLog();
    }

    function scheduleRefresh() {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refreshFromPage, 800);
    }

    function bindGUIEvents() {
        document.getElementById('delete-btn').onclick = performUnfriend;
        document.getElementById('clear-sel-btn').onclick = () => {
            selectedUserIds.clear();
            updateSelectedCount();
            renderSelectedLog();
            renderFriendsLog(friendCache);
            updatePageButtons();
        };
        document.getElementById('refresh-btn').onclick = () => {
            lastOrderKey = '';
            refreshFromPage();
        };
        document.getElementById('clear-history-btn').onclick = () => {
            if (confirm('Clear entire unfriended history?')) {
                unfriendedHistory = [];
                localStorage.removeItem('nebula_unfriended');
                renderUnfriendedLog();
            }
        };
        document.getElementById('theme-toggle').onclick = () => {
            isDark = !isDark;
            localStorage.setItem('nebula_dark', isDark ? '1' : '0');
            applyTheme();
            lastOrderKey = '';
            refreshFromPage();
        };
        document.getElementById('minimize-btn').onclick = () => {
            isMinimized = true;
            localStorage.setItem('nebula_minimized', '1');
            updateMinimizeState();
        };

        let isDragging = false, startX, startY, initRight, initTop;
        document.getElementById('gui-header').addEventListener('mousedown', e => {
            if (e.target.id === 'theme-toggle' || e.target.id === 'minimize-btn') return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = gui.getBoundingClientRect();
            initRight = window.innerWidth - rect.right;
            initTop = rect.top;
            gui.style.transition = 'none';
        });
        document.addEventListener('mousemove', e => {
            if (!isDragging || !gui) return;
            gui.style.right = (initRight - (e.clientX - startX)) + 'px';
            gui.style.top = (initTop + (e.clientY - startY)) + 'px';
        });
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                if (gui) gui.style.transition = 'right 0.15s ease, top 0.15s ease';
            }
        });
    }

    createMiniButton();
    refreshFromPage();

    window.addEventListener('hashchange', () => {
        lastOrderKey = '';
        scheduleRefresh();
    });

    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.body, { childList: true, subtree: true });

    setInterval(scheduleRefresh, 5000);
})();
