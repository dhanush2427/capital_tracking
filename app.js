// Set default date picker to today
document.getElementById("date").valueAsDate = new Date();

let allocationChartInstance = null;
let categoryChartInstance = null;

// Format currency in Indian Rupee format (e.g. ₹1,25,000)
function formatINR(number) {
    return "₹" + Number(number).toLocaleString("en-IN", {
        maximumFractionDigits: 2
    });
}

// Fetch both Transactions & Analytics from FastAPI Backend
async function refreshDashboard() {
    const [txRes, analyticsRes] = await Promise.all([
        fetch("/api/transactions"),
        fetch("/api/analytics")
    ]);

    const transactions = await txRes.json();
    const analytics = await analyticsRes.json();

    renderKPIs(analytics);
    renderTable(transactions);
    renderCharts(analytics);
}

// 1. Update Top KPI Cards
function renderKPIs(data) {
    document.getElementById("total-income").textContent = formatINR(data.total_income);
    document.getElementById("total-expense").textContent = formatINR(data.total_expense);
    document.getElementById("total-investment").textContent = formatINR(data.total_investment);
    document.getElementById("net-cash").textContent = formatINR(data.net_cash);

    document.getElementById("savings-rate").textContent = `${data.savings_rate}%`;
    document.getElementById("investment-rate").textContent = `${data.investment_rate}%`;
}

// 2. Update Ledger Table
function renderTable(transactions) {
    const tbody = document.getElementById("tx-table-body");
    document.getElementById("tx-count").textContent = `${transactions.length} entries`;
    tbody.innerHTML = "";

    if (transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500">No transactions recorded yet. Add your first entry above.</td></tr>`;
        return;
    }

    transactions.forEach(tx => {
        const badgeColor = 
            tx.type === "Income" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
            tx.type === "Investment" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" :
            "bg-rose-500/10 text-rose-400 border-rose-500/20";

        const row = document.createElement("tr");
        row.className = "hover:bg-slate-800/40 transition";
        row.innerHTML = `
            <td class="py-3 px-6 text-slate-400 whitespace-nowrap">${tx.date}</td>
            <td class="py-3 px-6 font-medium text-white">${tx.title}</td>
            <td class="py-3 px-6 text-slate-300">${tx.category}</td>
            <td class="py-3 px-6">
                <span class="text-xs px-2.5 py-1 rounded-full border ${badgeColor}">${tx.type}</span>
            </td>
            <td class="py-3 px-6 text-right font-semibold text-white whitespace-nowrap">${formatINR(tx.amount)}</td>
            <td class="py-3 px-6 text-right">
                <button onclick="deleteTx(${tx.id})" class="text-xs text-slate-500 hover:text-rose-400 transition">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// 3. Render Charts
function renderCharts(data) {
    const allocCtx = document.getElementById("allocationChart").getContext("2d");
    if (allocationChartInstance) allocationChartInstance.destroy();

    allocationChartInstance = new Chart(allocCtx, {
        type: "doughnut",
        data: {
            labels: ["Expenses", "Investments", "Unallocated Cash"],
            datasets: [{
                data: [
                    data.total_expense,
                    data.total_investment,
                    Math.max(0, data.net_cash)
                ],
                backgroundColor: ["#fb7185", "#818cf8", "#34d399"],
                borderColor: "#0f172a",
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "bottom", labels: { color: "#94a3b8", boxWidth: 12 } }
            }
        }
    });

    const catCtx = document.getElementById("categoryChart").getContext("2d");
    if (categoryChartInstance) categoryChartInstance.destroy();

    const categories = Object.keys(data.expense_by_category);
    const amounts = Object.values(data.expense_by_category);

    categoryChartInstance = new Chart(catCtx, {
        type: "bar",
        data: {
            labels: categories.length ? categories : ["No Expenses Yet"],
            datasets: [{
                label: "Spent (₹)",
                data: amounts.length ? amounts : [0],
                backgroundColor: "#fb7185",
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: "#94a3b8" }, grid: { display: false } },
                y: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } }
            }
        }
    });
}

// 4. Handle Form Submission (Add Transaction)
document.getElementById("tx-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
        title: document.getElementById("title").value,
        amount: parseFloat(document.getElementById("amount").value),
        type: document.getElementById("type").value,
        category: document.getElementById("category").value,
        date: document.getElementById("date").value
    };

    await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    document.getElementById("title").value = "";
    document.getElementById("amount").value = "";
    refreshDashboard();
});

// 5. Delete Transaction
async function deleteTx(id) {
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    refreshDashboard();
}

// Initial Load
refreshDashboard();