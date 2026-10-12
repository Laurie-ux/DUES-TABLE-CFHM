// CFHM Management System - Main JavaScript Logic

// In-app log capture: intercept console methods and store entries so user can download them
window.appLogs = window.appLogs || [];
(function() {
    const methods = ['log', 'info', 'warn', 'error'];
    methods.forEach(m => {
        const orig = console[m] ? console[m].bind(console) : function(){};
        console[m] = function(...args) {
            try {
                const textArgs = args.map(a => {
                    try { return (typeof a === 'object') ? JSON.stringify(a) : String(a); } catch (e) { return String(a); }
                });
                window.appLogs.push({ time: new Date().toISOString(), level: m, message: textArgs.join(' ') });
            } catch (e) {}
            orig(...args);
        };
    });
})();

function downloadLogs() {
    try {
        const content = (window.appLogs || []).map(l => `${l.time} [${l.level}] ${l.message}`).join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cfhm_logs_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'_')}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch (e) {
        alert('Failed to download logs: ' + e.message);
    }
}

class CFHMManager {
    constructor() {
        this.members = this.loadMembers();
        this.editingId = null;
        this.currentUser = this.loadCurrentUser();
        this._miniChart = null;
        this.init();
    }

    init() {
        this.setupLoginLogic();
        this.setupEventListeners();

        if (document.getElementById('membersBody')) {
            this.renderMembers();
            this.updateStatistics();
        }

        this.updateUserInfo();
        this.updateRoleControls();
    }

    setupLoginLogic() {
        const loginForm = document.getElementById('loginForm');
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');

        if (window.location.pathname.endsWith('login.html')) {
            if (localStorage.getItem('loggedInUser')) {
                window.location.href = 'index_clean.html';
                return;
            }

            if (loginForm) {
                loginForm.addEventListener('submit', (e) => this.handleLogin(e));
            }
            return;
        }

        const loggedInUser = localStorage.getItem('loggedInUser');
        if (!loggedInUser) {
            window.location.href = 'login.html';
            return;
        }

        try {
            this.currentUser = JSON.parse(loggedInUser);
        } catch (error) {
            localStorage.removeItem('loggedInUser');
            window.location.href = 'login.html';
            return;
        }

        if (loginScreen) loginScreen.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
    }

    handleLogin(e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();

        if (!username || !password) {
            alert('Please enter both your username and password.');
            return;
        }

        const isAdmin = username === 'admin' && password === 'admin123';
        const registeredUsers = JSON.parse(localStorage.getItem('cfhmUsers') || '[]');
        const user = registeredUsers.find(u => u.username === username && u.password === password);

        if (isAdmin || user) {
            this.currentUser = isAdmin ? {
                username: 'admin',
                fullName: 'Admin User',
                email: 'admin@cfhm.com',
                phone: '+1-800-0000',
                role: 'Administrator',
                address: 'CFHM Headquarters',
                joinDate: new Date().toLocaleDateString(),
                password: 'admin123'
            } : user;

            localStorage.setItem('loggedInUser', JSON.stringify(this.currentUser));

            const loginScreen = document.getElementById('loginScreen');
            const mainApp = document.getElementById('mainApp');
            if (loginScreen) loginScreen.style.display = 'none';
            if (mainApp) mainApp.style.display = 'block';

            this.updateUserInfo();
            window.location.href = 'index_clean.html';
            return;
        }

        alert('Invalid credentials. Please check your username and password.');
    }

    updateUserInfo() {
        if (this.currentUser) {
            const userDisplay = document.getElementById('loggedInUser');
            if (userDisplay) {
                userDisplay.textContent = `Welcome, ${this.currentUser.fullName || this.currentUser.username}`;
            }
        }
    }

    hasPrivilegedRole() {
        const role = String(this.currentUser?.role || '').trim().toLowerCase();
        return role === 'administrator' || role === 'admin' || role === 'manager';
    }

    updateRoleControls() {
        const canManage = this.hasPrivilegedRole();
        document.querySelectorAll('.member-management-control').forEach(button => {
            button.hidden = !canManage;
        });
        document.querySelectorAll('.user-management-control').forEach(button => {
            button.hidden = !canManage;
        });
    }

    loadCurrentUser() {
        const user = localStorage.getItem('loggedInUser');
        return user ? JSON.parse(user) : null;
    }

    setupEventListeners() {
        const form = document.getElementById('memberForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }
    }

    handleFormSubmit(e) {
        e.preventDefault();
        if (!this.hasPrivilegedRole()) {
            alert('Only Administrators and Managers can add or edit members.');
            return;
        }
        
        const name = document.getElementById('name').value.trim();
        const location = document.getElementById('location').value.trim();
        const contact = document.getElementById('contact').value.trim();
        const attendance = parseInt(document.getElementById('attendance').value);
        const duesStatus = document.getElementById('duesStatus').value;
        const duesAmount = parseFloat(document.getElementById('duesAmount').value);

        if (!name || !location || !contact || isNaN(attendance) || isNaN(duesAmount)) {
            this.showToast('Please fill all fields correctly', '#c62828');
            return;
        }

        if (this.editingId) {
            // Update existing member
            const member = this.members.find(m => m.id === this.editingId);
            if (member) {
                member.name = name;
                member.location = location;
                member.contact = contact;
                member.attendance = attendance;
                member.duesStatus = duesStatus;
                member.duesAmount = duesAmount;
                this.showToast('✓ Member updated successfully!', '#2e7d32');
            }
            this.editingId = null;
        } else {
            // Add new member
            const newMember = {
                id: Date.now(),
                name,
                location,
                contact,
                attendance,
                duesStatus,
                duesAmount,
                dateAdded: new Date().toLocaleDateString()
            };
            this.members.push(newMember);
            this.showToast('✓ Member added successfully!', '#2e7d32');
        }

        this.saveMembers();
        this.renderMembers();
        this.updateStatistics();
        document.getElementById('memberForm').reset();
        closeMemberModal();
    }

    showToast(message, bgColor) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.style.background = bgColor || '#2e7d32';
        toast.style.display = 'block';
        toast.style.opacity = '1';
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.style.display = 'none', 300);
        }, 2500);
    }

    renderMembers(membersToRender = null) {
        const tbody = document.getElementById('membersBody');
        const noMembersMsg = document.getElementById('noMembers');
        if (!tbody || !noMembersMsg) return;

        const displayMembers = membersToRender || this.members;

        tbody.innerHTML = '';

        if (displayMembers.length === 0) {
            noMembersMsg.style.display = 'block';
            return;
        }

        noMembersMsg.style.display = 'none';

        displayMembers.forEach(member => {
            const duesHistory = this.loadDuesHistory(member.id);
            const monthlyAmount = Number(member.duesAmount) || 0;
            const currentYear = new Date().getFullYear();
            let totalPaid = 0;
            for (let y = 2026; y <= currentYear; y++) {
                const yData = duesHistory[y.toString()] || {};
                const maxMonth = 12;
                for (let m = 1; m <= maxMonth; m++) {
                    const month = m.toString().padStart(2, '0');
                    if (yData[month] === true) {
                        totalPaid += monthlyAmount;
                    }
                }
            }

            const row = document.createElement('tr');
            const actionButtons = this.hasPrivilegedRole() ? `
                <div class="flex gap-2">
                    <button onclick="manager.viewDues(${member.id})" class="px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 smooth-transition">Dues</button>
                    <button onclick="manager.editMember(${member.id})" class="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 smooth-transition">Edit</button>
                    <button onclick="manager.deleteMember(${member.id})" class="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 smooth-transition">Delete</button>
                </div>` : '';
            
            // Color code based on dues status
            let statusColor = 'border-l-4 border-gray-300 bg-gray-50 hover:bg-gray-100';
            let badgeColor = 'bg-gray-100 text-gray-800';
            
            if (member.duesStatus === 'Paid') {
                statusColor = 'border-l-4 border-green-500 hover:bg-green-50';
                badgeColor = 'bg-green-100 text-green-800';
            } else if (member.duesStatus === 'Pending') {
                statusColor = 'border-l-4 border-yellow-500 hover:bg-yellow-50';
                badgeColor = 'bg-yellow-100 text-yellow-800';
            } else if (member.duesStatus === 'Overdue') {
                statusColor = 'border-l-4 border-red-500 hover:bg-red-50';
                badgeColor = 'bg-red-100 text-red-800';
            }
            
            row.className = `${statusColor} smooth-transition cursor-pointer hover:bg-blue-50`;
            row.innerHTML = `
                <td class="px-6 py-4 text-sm text-gray-700">${member.id}</td>
                <td class="px-6 py-4 text-sm font-medium text-gray-900">${member.name}</td>
                <td class="px-6 py-4 text-sm text-gray-700">${member.location}</td>
                <td class="px-6 py-4 text-sm text-gray-700">${member.contact}</td>
                <td class="px-6 py-4 text-sm text-gray-700">GHS${monthlyAmount.toFixed(2)}</td>
                <td class="px-6 py-4 text-sm text-gray-700">GHS${totalPaid.toFixed(2)}</td>
                <td class="px-6 py-4"><span class="px-3 py-1 rounded-full text-sm font-medium ${badgeColor}">${member.duesStatus}</span></td>
                <td class="px-6 py-4">
                    <div class="flex flex-col gap-2">
                        ${actionButtons}
                        <details class="mt-1">
                            <summary class="text-blue-600 cursor-pointer text-xs">Details ▼</summary>
                            <div class="mt-1 text-xs text-gray-700">
                                Location: ${member.location}<br>
                                Contact: ${member.contact}<br>
                                Monthly: GHS${monthlyAmount.toFixed(2)}<br>
                                Attendance: ${member.attendance} days
                            </div>
                        </details>
                    </div>
                </td>
            `;

            row.addEventListener('click', (event) => {
                if (event.target.closest('button') || event.target.closest('details') || event.target.closest('summary')) {
                    return;
                }
                openMemberDetailsModal(member.id);
            });

            tbody.appendChild(row);
        });
    }

    // remove any existing inline edit row
    removeInlineEditor() {
        const existing = document.querySelector('tr.inline-edit-row');
        if (existing) existing.remove();
    }

    editMember(id) {
        if (!this.hasPrivilegedRole()) {
            alert('Only Administrators and Managers can edit members.');
            return;
        }
        const member = this.members.find(m => m.id === id);
        if (!member) return;

        // if we already have this member open, just close it
        const existing = document.getElementById('inline-edit-' + id);
        if (existing) {
            existing.remove();
            return;
        }

        this.removeInlineEditor();

        const rows = document.querySelectorAll('#membersBody tr');
        let targetRow = null;
        rows.forEach(row => {
            if (row.firstElementChild && row.firstElementChild.textContent == id) {
                targetRow = row;
            }
        });
        if (!targetRow) return;

        const formRow = document.createElement('tr');
        formRow.className = 'inline-edit-row bg-gray-50';
        formRow.id = 'inline-edit-' + id;
        formRow.innerHTML = `
            <td colspan="9" class="p-4">
                <form id="inlineEditForm" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="hidden" id="editId" value="${id}">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                        <input type="text" id="editName" value="${member.name}" class="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Location</label>
                        <input type="text" id="editLocation" value="${member.location}" class="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Contact</label>
                        <input type="tel" id="editContact" value="${member.contact}" class="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Attendance</label>
                        <input type="number" id="editAttendance" value="${member.attendance}" min="0" class="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Dues Status</label>
                        <select id="editDuesStatus" class="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
                            <option ${member.duesStatus==='Paid'?'selected':''} value="Paid">Paid</option>
                            <option ${member.duesStatus==='Pending'?'selected':''} value="Pending">Pending</option>
                            <option ${member.duesStatus==='Overdue'?'selected':''} value="Overdue">Overdue</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Monthly Dues</label>
                        <input type="number" id="editDuesAmount" value="${member.duesAmount}" min="0" step="0.01" class="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
                    </div>
                    <div class="col-span-full flex gap-4 pt-4">
                        <button type="submit" class="px-6 py-2 bg-green-600 text-white rounded-lg">Save</button>
                        <button type="button" id="cancelInlineEdit" class="px-6 py-2 bg-gray-400 text-white rounded-lg">Cancel</button>
                    </div>
                </form>
            </td>
        `;

        targetRow.parentNode.insertBefore(formRow, targetRow.nextSibling);

        document.getElementById('cancelInlineEdit').addEventListener('click', () => {
            formRow.remove();
        });

        document.getElementById('inlineEditForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.applyInlineEdit();
        });
    }

    applyInlineEdit() {
        if (!this.hasPrivilegedRole()) return;
        const id = parseInt(document.getElementById('editId').value, 10);
        const member = this.members.find(m => m.id === id);
        if (!member) return;
        member.name = document.getElementById('editName').value.trim();
        member.location = document.getElementById('editLocation').value.trim();
        member.contact = document.getElementById('editContact').value.trim();
        member.attendance = parseInt(document.getElementById('editAttendance').value);
        member.duesStatus = document.getElementById('editDuesStatus').value;
        member.duesAmount = parseFloat(document.getElementById('editDuesAmount').value);
        this.saveMembers();
        this.renderMembers();
        this.updateStatistics();
        this.showToast('✓ Member updated successfully!', '#2e7d32');
        this.removeInlineEditor();
    }

    deleteMember(id) {
        if (!this.hasPrivilegedRole()) {
            alert('Only Administrators and Managers can delete members.');
            return;
        }
        const member = this.members.find(m => m.id === id);
        if (member) {
            if (confirm(`Are you sure you want to delete ${member.name}?`)) {
                this.members = this.members.filter(m => m.id !== id);
                this.saveMembers();
                this.renderMembers();
                this.updateStatistics();
                this.showToast('✓ Member deleted successfully!', '#2e7d32');
            }
        }
    }

    updateStatistics() {
        const totalMembersEl = document.getElementById('totalMembers');
        const pendingDuesEl = document.getElementById('pendingDues');
        const avgAttendanceEl = document.getElementById('avgAttendance');
        const totalDuesOwedEl = document.getElementById('totalDuesOwed');

        if (!totalMembersEl && !pendingDuesEl && !avgAttendanceEl && !totalDuesOwedEl) {
            return;
        }

        const totalMembers = this.members.length;
        const pendingDues = this.members.filter(m => m.duesStatus !== 'Paid').length;
        const avgAttendance = totalMembers > 0 
            ? Math.round(this.members.reduce((sum, m) => sum + m.attendance, 0) / totalMembers)
            : 0;
        const totalDuesOwed = this.members.reduce((sum, m) => {
            const duesHistory = this.loadDuesHistory(m.id);
            const monthlyAmount = Number(m.duesAmount) || 0;
            const currentYear = new Date().getFullYear();
            let payable = 0;
            for (let y = 2026; y <= currentYear; y++) {
                const yData = duesHistory[y.toString()] || {};
                const maxMonth = 12;
                for (let mth = 1; mth <= maxMonth; mth++) {
                    const month = mth.toString().padStart(2, '0');
                    if (yData[month] !== true) {
                        payable += monthlyAmount;
                    }
                }
            }
            return sum + payable;
        }, 0);

        if (totalMembersEl) totalMembersEl.textContent = totalMembers;
        if (pendingDuesEl) pendingDuesEl.textContent = pendingDues;
        if (avgAttendanceEl) avgAttendanceEl.textContent = avgAttendance;
        if (totalDuesOwedEl) totalDuesOwedEl.textContent = 'GHS' + totalDuesOwed.toFixed(2);
    }

    saveMembers() {
        localStorage.setItem('cfhmMembers', JSON.stringify(this.members));
    }

    loadMembers() {
        const stored = localStorage.getItem('cfhmMembers');
        return stored ? JSON.parse(stored) : [];
    }

    viewDues(memberId) {
        if (!this.hasPrivilegedRole()) {
            alert('Only Administrators and Managers can manage dues.');
            return;
        }
        const member = this.members.find(m => m.id === memberId);
        if (!member) return;

        this.currentEditingMemberId = memberId;
        document.getElementById('duesMemberName').textContent = member.name;

        const duesHistory = this.loadDuesHistory(memberId);

        const yearSelect = document.getElementById('duesYearSelect');
        yearSelect.innerHTML = '<option value="">Choose a year...</option>';
        for (let year = 2026; year <= new Date().getFullYear(); year++) {
            yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
        }
        yearSelect.value = new Date().getFullYear().toString();

        this.renderDuesPaymentGrid(duesHistory);

        document.getElementById('duesModal').classList.remove('hidden');
    }

    loadDuesHistory(memberId) {
        const duesData = JSON.parse(localStorage.getItem('duesHistory') || '{}');
        return duesData[memberId] || {};
    }

    renderDuesPaymentGrid(duesHistory) {
        const grid = document.getElementById('duesPaymentGrid');
        const year = document.getElementById('duesYearSelect').value;
        grid.innerHTML = '';

        if (!year) {
            grid.innerHTML = '<p class="col-span-full text-gray-500">Please select a year</p>';
            return;
        }

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const yearKey = year;
        const yearData = duesHistory[yearKey] || {};

        months.forEach((month, index) => {
            const monthNum = (index + 1).toString().padStart(2, '0');
            const isPaid = yearData[monthNum] === true;

            const label = document.createElement('label');
            label.className = 'flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-blue-50 smooth-transition';
            label.style.borderColor = isPaid ? '#10b981' : '#d1d5db';
            label.style.backgroundColor = isPaid ? '#f0fdf4' : 'white';

            label.innerHTML = `
                <input type="checkbox" class="duesCheckbox" data-month="${monthNum}" ${isPaid ? 'checked' : ''}>
                <span class="font-medium ${isPaid ? 'text-green-600' : 'text-gray-700'}">${month}</span>
            `;
            grid.appendChild(label);
        });

        // Add real-time update listeners
        document.querySelectorAll('.duesCheckbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateMemberPaidAmount();
            });
        });
    }

    updateMemberPaidAmount() {
        const member = this.members.find(m => m.id === this.currentEditingMemberId);
        if (!member) return;

        const duesHistory = this.loadDuesHistory(member.id);
        const monthlyAmount = Number(member.duesAmount) || 0;
        const currentYear = new Date().getFullYear();
        const year = document.getElementById('duesYearSelect').value;

        let totalPaid = 0;

        // Add from saved history for other years
        for (let y = 2026; y <= currentYear; y++) {
            if (y == year) continue;
            const yData = duesHistory[y.toString()] || {};
            const maxMonth = 12;
            for (let m = 1; m <= maxMonth; m++) {
                const month = m.toString().padStart(2, '0');
                if (yData[month] === true) {
                    totalPaid += monthlyAmount;
                }
            }
        }

        // Add from current checkboxes
        document.querySelectorAll('.duesCheckbox').forEach(cb => {
            if (cb.checked) {
                totalPaid += monthlyAmount;
            }
        });

        // Update the td in the list
        const rows = document.querySelectorAll('#membersTable tbody tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells[0].textContent == member.id) {
                cells[4].textContent = 'GHS' + totalPaid.toFixed(2);
            }
        });
    }

    markYearPaid() {
        const year = document.getElementById('duesYearSelect').value;
        if (!year) {
            alert('Please select a year first');
            return;
        }
        document.querySelectorAll('.duesCheckbox').forEach(checkbox => {
            checkbox.checked = true;
        });
    }

    markYearUnpaid() {
        const year = document.getElementById('duesYearSelect').value;
        if (!year) {
            alert('Please select a year first');
            return;
        }
        document.querySelectorAll('.duesCheckbox').forEach(checkbox => {
            checkbox.checked = false;
        });
    }

    saveDuesPayments() {
        if (!this.hasPrivilegedRole()) {
            alert('Only Administrators and Managers can manage dues.');
            return;
        }
        const year = document.getElementById('duesYearSelect').value;
        if (!year || !this.currentEditingMemberId) {
            alert('Please select a year');
            return;
        }

        const duesHistory = this.loadDuesHistory(this.currentEditingMemberId);

        if (!duesHistory[year]) {
            duesHistory[year] = {};
        }

        document.querySelectorAll('.duesCheckbox').forEach(checkbox => {
            const month = checkbox.getAttribute('data-month');
            duesHistory[year][month] = checkbox.checked;
        });

        const allDuesData = JSON.parse(localStorage.getItem('duesHistory') || '{}');
        allDuesData[this.currentEditingMemberId] = duesHistory;
        localStorage.setItem('duesHistory', JSON.stringify(allDuesData));

        // Update member status based on payment
        const memberToUpdate = this.members.find(m => m.id === this.currentEditingMemberId);
        if (memberToUpdate) {
            let paidUpToYear = 2025;
            const currentYear = new Date().getFullYear();
            for (let y = 2026; y <= currentYear; y++) {
                const yData = duesHistory[y.toString()] || {};
                const maxMonth = 12;
                let yearFullyPaid = true;
                for (let m = 1; m <= maxMonth; m++) {
                    const month = m.toString().padStart(2, '0');
                    if (yData[month] !== true) {
                        yearFullyPaid = false;
                        break;
                    }
                }
                if (yearFullyPaid) {
                    paidUpToYear = y;
                } else {
                    break;
                }
            }
            memberToUpdate.duesStatus = (paidUpToYear === currentYear) ? 'Paid' : 'Pending';
            this.saveMembers();
            this.renderMembers(); // update the list
            this.updateStatistics(); // update bottom stats
        }
        this.showToast('✓ Dues payment history saved!', '#2e7d32');
        closeDuesModal();
    }
}

function openMemberDetailsModal(memberId) {
    if (!manager || !manager.members) return;

    const member = manager.members.find(item => item.id === memberId);
    if (!member) return;

    const totalPaid = calculateMemberTotalPaid(member);
    const details = document.getElementById('memberDetailsContent');
    if (!details) return;

    const duesHistory = manager.loadDuesHistory(member.id);
    const currentYear = new Date().getFullYear();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const startYear = 2021;
    let paymentBreakdown = '';

    const yearHeaders = months.map(month => `<th class="border px-2 py-1 text-[10px] font-semibold text-gray-700 bg-gray-100">${month}</th>`).join('');
    const yearRows = [];

    for (let year = startYear; year <= currentYear; year++) {
        const yearData = duesHistory[String(year)] || {};
        const cells = months.map((month, index) => {
            const monthKey = (index + 1).toString().padStart(2, '0');
            const paid = yearData[monthKey] === true;
            return `<td class="border px-2 py-1 text-center text-[10px] ${paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${paid ? 'P' : 'D'}</td>`;
        }).join('');
        yearRows.push(`<tr><td class="border px-2 py-1 text-[10px] font-semibold text-gray-800 bg-gray-50">${year}</td>${cells}</tr>`);
    }

    paymentBreakdown = `
        <div class="mt-4 overflow-x-auto">
            <table class="w-full border-collapse text-left">
                <thead>
                    <tr>
                        <th class="border px-2 py-1 text-[10px] font-semibold text-gray-700 bg-gray-100">Year</th>
                        ${yearHeaders}
                    </tr>
                </thead>
                <tbody>
                    ${yearRows.join('')}
                </tbody>
            </table>
        </div>
    `;

    details.innerHTML = `
        <p><strong>Name:</strong> ${member.name}</p>
        <p><strong>Location:</strong> ${member.location}</p>
        <p><strong>Contact:</strong> ${member.contact}</p>
        <p><strong>Monthly Due:</strong> GHS${Number(member.duesAmount || 0).toFixed(2)}</p>
        <p><strong>Current Status:</strong> ${member.duesStatus}</p>
        <p><strong>Total Paid:</strong> GHS${totalPaid.toFixed(2)}</p>
        <p><strong>Attendance:</strong> ${member.attendance} days</p>
        <div class="mt-4 border-t pt-4">
            <h4 class="font-bold text-gray-800 mb-3">Payment Breakdown (Last 5 Years)</h4>
            ${paymentBreakdown}
        </div>
    `;

    const modal = document.getElementById('memberDetailsModal');
    if (modal) modal.classList.remove('hidden');
}

function closeMemberDetailsModal() {
    const modal = document.getElementById('memberDetailsModal');
    if (modal) modal.classList.add('hidden');
}

function calculateMemberTotalPaid(member) {
    if (!member) return 0;

    const duesHistory = manager ? manager.loadDuesHistory(member.id) : {};
    const monthlyAmount = Number(member.duesAmount) || 0;
    const currentYear = new Date().getFullYear();
    let totalPaid = 0;

    for (let y = 2026; y <= currentYear; y++) {
        const yData = duesHistory[y.toString()] || {};
        const maxMonth = 12;
        for (let m = 1; m <= maxMonth; m++) {
            const month = m.toString().padStart(2, '0');
            if (yData[month] === true) {
                totalPaid += monthlyAmount;
            }
        }
    }

    return totalPaid;
}

// Global manager instance
let manager;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    manager = new CFHMManager();
});

// Filter and search functions
function applyFilters() {
    if (!manager || !manager.members) return;

    const searchInput = document.getElementById('searchInput');
    const filterStatusEl = document.getElementById('filterStatus');
    if (!searchInput || !filterStatusEl) return;

    const searchTerm = searchInput.value.toLowerCase();
    const filterStatus = filterStatusEl.value;

    const filtered = manager.members.filter(member => {
        const matchesSearch = member.name.toLowerCase().includes(searchTerm) || 
                            member.location.toLowerCase().includes(searchTerm);
        const matchesStatus = !filterStatus || member.duesStatus === filterStatus;
        return matchesSearch && matchesStatus;
    });

    manager.renderMembers(filtered);
}

function resetFilters() {
    const searchInput = document.getElementById('searchInput');
    const filterStatusEl = document.getElementById('filterStatus');

    if (searchInput) searchInput.value = '';
    if (filterStatusEl) filterStatusEl.value = '';
    if (manager) manager.renderMembers();
}

// Search in real-time as user types
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }
});

// Modal functions
function closeModal() {
    document.getElementById('actionModal').classList.add('hidden');
}

// Export data as CSV
function exportToCSV() {
    if (manager.members.length === 0) {
        alert('No members to export');
        return;
    }

    const headers = ['ID', 'Name', 'Location', 'Contact', 'Monthly Dues', 'Attendance', 'Dues Paid', 'Status'];
    const rows = manager.members.map(m => {
        // compute paid amount for CSV as well
        const duesHistory = manager.loadDuesHistory(m.id);
        const monthlyAmount = Number(m.duesAmount) || 0;
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        let totalPaid = 0;
        for (let y = 2026; y <= currentYear; y++) {
            const yData = duesHistory[y.toString()] || {};
            const maxMonth = (y === currentYear) ? currentMonth : 12;
            for (let mth = 1; mth <= maxMonth; mth++) {
                const month = mth.toString().padStart(2, '0');
                if (yData[month] === true) {
                    totalPaid += monthlyAmount;
                }
            }
        }
        return [
            m.id,
            m.name,
            m.location,
            m.contact,
            m.duesAmount,
            m.attendance,
            totalPaid.toFixed(2),
            m.duesStatus
        ];
    });

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CFHM_Members_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// User Profile Functions
function openUserProfile() {
    const modal = document.getElementById('userProfileModal');
    if (!modal || !manager || !manager.currentUser) return;

    const fields = {
        profileUsername: manager.currentUser.username || '',
        profileFullName: manager.currentUser.fullName || '',
        profileEmail: manager.currentUser.email || '',
        profilePhone: manager.currentUser.phone || '',
        profileAddress: manager.currentUser.address || ''
    };

    if (document.getElementById('profileRole')) {
        document.getElementById('profileRole').value = manager.currentUser.role || 'User';
    }
    if (document.getElementById('profileJoinDate')) {
        document.getElementById('profileJoinDate').value = manager.currentUser.joinDate || new Date().toLocaleDateString();
    }

    Object.entries(fields).forEach(([id, value]) => {
        const field = document.getElementById(id);
        if (field) field.value = value;
    });

    modal.classList.remove('hidden');
}

function closeUserProfile() {
    const modal = document.getElementById('userProfileModal');
    if (modal) modal.classList.add('hidden');
}

function closeChangePassword() {
    const modal = document.getElementById('changePasswordModal');
    if (modal) modal.classList.add('hidden');
}

// Member Modal Functions
function openAddMemberModal() {
    document.getElementById('memberModalTitle').textContent = 'Add New Member';
    document.getElementById('memberForm').reset();
    manager.editingId = null;
    document.getElementById('memberModal').classList.remove('hidden');
}

function closeMemberModal() {
    document.getElementById('memberModal').classList.add('hidden');
    document.getElementById('memberForm').reset();
    manager.editingId = null;
}

function changePassword() {
    const userProfileModal = document.getElementById('userProfileModal');
    const changePasswordModal = document.getElementById('changePasswordModal');

    if (userProfileModal) userProfileModal.classList.add('hidden');
    if (changePasswordModal) {
        setTimeout(() => changePasswordModal.classList.remove('hidden'), 300);
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('loggedInUser');
        location.reload();
    }
}

// Wire small UI handlers after page load (profile/password/dues year)
document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('userProfileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const updatedUser = {
                ...manager.currentUser,
                fullName: document.getElementById('profileFullName').value.trim(),
                email: document.getElementById('profileEmail').value.trim(),
                phone: document.getElementById('profilePhone').value.trim(),
                address: document.getElementById('profileAddress').value.trim()
            };
            manager.currentUser = updatedUser;
            localStorage.setItem('loggedInUser', JSON.stringify(updatedUser));
            manager.updateUserInfo();
            alert('Profile updated successfully!');
            closeUserProfile();
        });
    }

    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (!manager.currentUser || currentPassword !== manager.currentUser.password) {
                alert('Current password is incorrect!');
                return;
            }
            if (newPassword !== confirmPassword) {
                alert('New passwords do not match!');
                return;
            }
            if (newPassword.length < 6) {
                alert('Password must be at least 6 characters long!');
                return;
            }
            manager.currentUser.password = newPassword;
            localStorage.setItem('loggedInUser', JSON.stringify(manager.currentUser));
            alert('Password changed successfully!');
            changePasswordForm.reset();
            closeChangePassword();
        });
    }

    const yearSelect = document.getElementById('duesYearSelect');
    if (yearSelect) {
        yearSelect.addEventListener('change', () => {
            const duesHistory = manager.loadDuesHistory(manager.currentEditingMemberId);
            manager.renderDuesPaymentGrid(duesHistory);
        });
    }
});

// Global modal functions
function openAddMemberModal() {
    if (!manager || !manager.hasPrivilegedRole()) {
        alert('Only Administrators and Managers can add members.');
        return;
    }
    const memberForm = document.getElementById('memberForm');
    const memberModal = document.getElementById('memberModal');
    const memberModalTitle = document.getElementById('memberModalTitle');

    if (memberForm) memberForm.reset();
    if (manager) manager.editingId = null;
    if (memberModalTitle) memberModalTitle.textContent = 'Add New Member';
    if (memberModal) memberModal.classList.remove('hidden');
}

function openUserCreation() {
    if (!manager || !manager.hasPrivilegedRole()) {
        alert('Only Administrators and Managers can create users.');
        return;
    }
    window.location.href = 'user-form.html';
}

function closeMemberModal() {
    const memberModal = document.getElementById('memberModal');
    const memberForm = document.getElementById('memberForm');

    if (memberModal) memberModal.classList.add('hidden');
    if (memberForm) memberForm.reset();
    if (manager) manager.editingId = null;
}

function openUserProfile() {
    if (!manager || !manager.currentUser) return;
    const modal = document.getElementById('userProfileModal');
    if (!modal) return;

    const user = manager.currentUser;
    const map = {
        profileUsername: user.username || '',
        profileFullName: user.fullName || '',
        profileEmail: user.email || '',
        profilePhone: user.phone || '',
        profileRole: user.role || '',
        profileAddress: user.address || ''
    };

    Object.entries(map).forEach(([id, value]) => {
        const field = document.getElementById(id);
        if (field) field.value = value;
    });

    modal.classList.remove('hidden');
}

function closeUserProfile() {
    const modal = document.getElementById('userProfileModal');
    if (modal) modal.classList.add('hidden');
}

function changePassword() {
    const userProfileModal = document.getElementById('userProfileModal');
    const changePasswordModal = document.getElementById('changePasswordModal');

    if (userProfileModal) userProfileModal.classList.add('hidden');
    if (changePasswordModal) changePasswordModal.classList.remove('hidden');
}

function closeChangePassword() {
    const modal = document.getElementById('changePasswordModal');
    if (modal) modal.classList.add('hidden');
}

function closeDuesModal() {
    const modal = document.getElementById('duesModal');
    if (modal) modal.classList.add('hidden');
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('loggedInUser');
        window.location.href = 'login.html';
    }
}

// Global wrapper so inline onclick in HTML works
function saveDuesPayments() {
    if (typeof manager === 'undefined' || !manager) {
        alert('Manager not initialized yet. Please try again.');
        return;
    }
    if (typeof manager.saveDuesPayments === 'function') {
        manager.saveDuesPayments();
    } else {
        alert('Save function unavailable.');
    }
}

