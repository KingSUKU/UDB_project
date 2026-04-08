const API_URL =
    window.location.hostname === 'localhost' && window.location.port !== '3000'
        ? 'http://localhost:5000'
        : '/api';

let studentsMap = {};

document.addEventListener('DOMContentLoaded', () => {
    fetchDashboardData();

    document.getElementById('student-form').addEventListener('submit', handleAddStudent);
    document.getElementById('marks-form').addEventListener('submit', handleAddMarks);
    document.getElementById('averages-table-body').addEventListener('click', handleTableClick);
});

function setSystemStatus(isOnline, label) {
    const footer = document.querySelector('.sidebar-footer p');

    if (!footer) {
        return;
    }

    footer.innerHTML = `System Status: <span class="status-indicator"></span> ${label}`;

    const indicator = footer.querySelector('.status-indicator');
    if (indicator) {
        indicator.style.background = isOnline ? 'var(--success)' : 'var(--danger)';
    }
}

async function parseJsonResponse(response) {
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data;
}

function showLoadError(message) {
    document.getElementById('top-performers-list').innerHTML = `<li><span class="loading">${message}</span></li>`;
    document.getElementById('above-75-list').innerHTML = `<li><span class="loading">${message}</span></li>`;
    document.getElementById('averages-table-body').innerHTML =
        `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--danger)">${message}</td></tr>`;
}

async function fetchDashboardData() {
    try {
        const studentsRes = await fetch(`${API_URL}/students`);
        const students = await parseJsonResponse(studentsRes);

        studentsMap = {};
        students.forEach((student) => {
            studentsMap[student.student_id] = student.name;
        });

        const [avgRes, topRes, above75Res] = await Promise.all([
            fetch(`${API_URL}/average`),
            fetch(`${API_URL}/top`),
            fetch(`${API_URL}/above75`)
        ]);

        const avgData = await parseJsonResponse(avgRes);
        const topData = await parseJsonResponse(topRes);
        const above75Data = await parseJsonResponse(above75Res);

        renderTopPerformers(topData);
        renderAbove75(above75Data);
        renderAveragesTable(avgData);
        setSystemStatus(true, 'Online');
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setSystemStatus(false, 'Offline');
        showLoadError(error.message || 'Unable to load dashboard data.');
    }
}

function getStudentName(studentId) {
    return studentsMap[studentId] || 'Unknown Student';
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderTopPerformers(data) {
    const container = document.getElementById('top-performers-list');
    container.innerHTML = '';

    if (data.length === 0) {
        container.innerHTML = '<li><span class="loading">No data available yet.</span></li>';
        return;
    }

    data.forEach((item, index) => {
        const badges = ['#1', '#2', '#3'];
        const badge = badges[index] || '#';

        container.innerHTML += `
            <li>
                <div class="student-info">
                    <span class="student-name">${badge} ${getStudentName(item._id)}</span>
                    <span class="student-id-display">ID: ${item._id}</span>
                </div>
                <span class="score">${item.avgMarks.toFixed(1)}%</span>
            </li>
        `;
    });
}

function renderAbove75(data) {
    const container = document.getElementById('above-75-list');
    container.innerHTML = '';

    if (data.length === 0) {
        container.innerHTML = '<li><span class="loading">No students above 75% yet.</span></li>';
        return;
    }

    data.forEach((item) => {
        container.innerHTML += `
            <li>
                <div class="student-info">
                    <span class="student-name">${getStudentName(item._id)}</span>
                    <span class="student-id-display">ID: ${item._id}</span>
                </div>
                <span class="score">${item.avgMarks.toFixed(1)}%</span>
            </li>
        `;
    });
}

function renderAveragesTable(data) {
    const tbody = document.getElementById('averages-table-body');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted)">No records found. Add students and marks.</td></tr>';
        return;
    }

    data.forEach((item) => {
        const avg = item.avgMarks;
        let statusClass = 'status-needs-work';
        let statusText = 'Needs Work';

        if (avg >= 85) {
            statusClass = 'status-excellent';
            statusText = 'Excellent';
        } else if (avg >= 60) {
            statusClass = 'status-good';
            statusText = 'Good';
        }

        tbody.innerHTML += `
            <tr>
                <td style="font-family: monospace; color: var(--text-muted)">${escapeHtml(item._id)}</td>
                <td style="font-weight: 500">${escapeHtml(getStudentName(item._id))}</td>
                <td>
                    <div style="display:flex; align-items:center; gap: 0.5rem">
                        <div style="flex:1; height: 6px; background: #e5e7eb; border-radius: 999px; max-width: 100px; overflow: hidden;">
                            <div style="height: 100%; width: ${avg}%; background: var(--primary-color)"></div>
                        </div>
                        <span style="font-weight: 600">${avg.toFixed(1)}%</span>
                    </div>
                </td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <button
                        type="button"
                        class="delete-student-btn"
                        data-student-id="${encodeURIComponent(item._id)}"
                        style="padding: 4px 8px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 500;"
                    >
                        Delete
                    </button>
                </td>
            </tr>
        `;
    });
}

function handleTableClick(event) {
    const deleteButton = event.target.closest('.delete-student-btn');

    if (!deleteButton) {
        return;
    }

    const studentId = decodeURIComponent(deleteButton.dataset.studentId || '');
    if (studentId) {
        deleteStudent(studentId);
    }
}

async function handleAddStudent(event) {
    event.preventDefault();

    const student_id = document.getElementById('student_id').value.trim();
    const name = document.getElementById('student_name').value.trim();
    const button = event.target.querySelector('button');
    button.textContent = 'Adding...';

    try {
        const response = await fetch(`${API_URL}/students`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id, name })
        });

        await parseJsonResponse(response);
        event.target.reset();
        await fetchDashboardData();
    } catch (error) {
        alert(error.message || 'Server connection failed.');
    } finally {
        button.textContent = 'Create Student';
    }
}

async function handleAddMarks(event) {
    event.preventDefault();

    const student_id = document.getElementById('mark_student_id').value.trim();
    const subject_id = document.getElementById('subject_id').value.trim();
    const marks = document.getElementById('marks_value').value;
    const button = event.target.querySelector('button');
    button.textContent = 'Adding...';

    try {
        const response = await fetch(`${API_URL}/marks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_id,
                subject_id,
                marks: Number(marks)
            })
        });

        await parseJsonResponse(response);
        event.target.reset();
        await fetchDashboardData();
    } catch (error) {
        alert(error.message || 'Server connection failed.');
    } finally {
        button.textContent = 'Add Marks';
    }
}

async function deleteStudent(studentId) {
    if (!confirm('Are you sure you want to delete this student and all their marks?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/delete-student`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: studentId })
        });

        await parseJsonResponse(response);
        await fetchDashboardData();
    } catch (error) {
        alert(error.message || 'Server connection failed.');
    }
}
