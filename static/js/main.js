// main.js — CryptoSentiment FINAL CLEAN MERGED VERSION

console.log("Loaded: main.js");

(function () {

// ============================
// HELPERS
// ============================
function q(s){ return document.querySelector(s); }
function formatCurrency(n){
    if(n === null || n === undefined) return "$-";
    return "$"+Number(n).toLocaleString(undefined,{maximumFractionDigits:2});
}
function safePercent(n){
    if(n === null || n === undefined) return "-";
    return Number(n).toFixed(2)+"%";
}
function handleApiWrapper(resp){
    if(!resp) return {ok:false};
    if(resp.status === "success") return {ok:true, data:resp.data};
    if(Array.isArray(resp)) return {ok:true, data:resp};
    if(resp.prices) return {ok:true, data:resp};
    return {ok:false};
}


// ============================
// COINS
// ============================
const COINS = {
    bitcoin: "btc",
    ethereum: "eth",
    tether: "usdt",
    solana: "sol",
    ripple: "xrp",
    binancecoin: "bnb",
    dogecoin: "doge",
    tron: "trx",
    hyperliquid: "hlp",
    cardano: "ada"
};


// ============================
// UPDATE PRICE UI
// ============================
function updateUI(prefix, coin){
    q(`#${prefix}-price`).textContent  = formatCurrency(coin.current_price);
    q(`#${prefix}-volume`).textContent = formatCurrency(coin.total_volume);

    const el = q(`#${prefix}-change`);
    const pct = coin.price_change_percentage_24h;

    el.textContent = safePercent(pct);
    el.classList.remove("price-up", "price-down");
    el.classList.add(pct >= 0 ? "price-up" : "price-down");
}


// ============================
// FETCH PRICES
// ============================
async function fetchPrices(){
    try{
        const res = await fetch("/api/prices");
        const json = await res.json();
        const wrap = handleApiWrapper(json);
        if(!wrap.ok) return;

        wrap.data.forEach(coin => {
            const key = COINS[coin.id];
            if(key) updateUI(key, coin);
        });

    }catch(e){
        console.error("Price error:", e);
    }
}


// ============================
// THEME SYSTEM
// ============================
function getThemeColors(){
    const dark=document.body.classList.contains("dark");
    return {
        bg: dark ? "#0b0f19" : "#ffffff",
        grid: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
        text: dark ? "#d4d9e3" : "#2d3436",
        fade: dark ? "rgba(255,75,75,0.10)" : "rgba(255,75,75,0.18)"
    };
}


// ============================
// PRICE CHART
// ============================
let chartCooldown = false;
let currentCoin = "bitcoin";
let lastDays = 1;

async function fetchChart(coin = currentCoin, days = lastDays){
    try{
        if(chartCooldown) return;
        chartCooldown = true;
        setTimeout(()=> chartCooldown = false, 1200);

        currentCoin = coin;
        lastDays = days;

        const res = await fetch(`/api/chart/${coin}?days=${days}`);
        const json = await res.json();
        const wrap = handleApiWrapper(json);

        if(!wrap.ok) throw new Error("chart_error");

        const prices = wrap.data.prices || [];
        
        // FIX FINAL — always reverse CoinGecko data (2025 update)
        prices.reverse();


        const times = prices.map(p => new Date(p[0]));
        const vals  = prices.map(p => p[1]);

        const T = getThemeColors();

        Plotly.newPlot("price-chart", [{
            x: times,
            y: vals,
            type:"scatter",
            mode:"lines",
            line:{color:"#ff4b4b", width:2, shape:"spline"},
            fill:"tozeroy",
            fillcolor:T.fade
        }], {
            paper_bgcolor:T.bg,
            plot_bgcolor:T.bg,
            xaxis:{ gridcolor:T.grid, tickfont:{color:T.text} },
            yaxis:{ gridcolor:T.grid, tickfont:{color:T.text}, tickprefix:"$" },
            margin:{t:30, b:40, l:50, r:40},
            showlegend:false
        });

    }catch(e){
        console.error("Chart error:",e);
        q("#price-chart").innerHTML =
            `<div class="p-4 text-red-400">Gagal memuat grafik</div>`;
    }
}

window.updateChartPeriod = (d)=> fetchChart(currentCoin, d);
window.changeCoin = (c)=> fetchChart(c, lastDays);


// ============================
// SENTIMENT (FINBERT REAL DATA)
// ============================
async function fetchSentiment(){
    try{
        const res  = await fetch("/api/sentiment");
        const arr  = await res.json();
        if(!Array.isArray(arr)) return;

        const pos = arr.filter(n=>n.sentiment==="positive").length;
        const neu = arr.filter(n=>n.sentiment==="neutral").length;
        const neg = arr.filter(n=>n.sentiment==="negative").length;
        const total = arr.length || 1;

        q("#positive-bar").style.width = (pos/total*100)+"%";
        q("#neutral-bar").style.width  = (neu/total*100)+"%";
        q("#negative-bar").style.width = (neg/total*100)+"%";

        q("#positive-percent").textContent = Math.round(pos/total*100)+"%";
        q("#neutral-percent").textContent  = Math.round(neu/total*100)+"%";
        q("#negative-percent").textContent = Math.round(neg/total*100)+"%";

        const wrap = q("#news-container");        if(wrap) wrap.innerHTML = "";

        arr.forEach(item=>{
            let color =
                item.sentiment==="positive" ? "text-green-400" :
                item.sentiment==="negative" ? "text-red-400" :
                "text-yellow-400";

            const card = document.createElement("div");
            card.className="glass-card p-5 rounded-xl";

            card.innerHTML = `
                <div class="flex justify-between mb-2">
                    <span class="font-semibold ${color}">
                        ${item.sentiment.toUpperCase()}
                    </span>
                    <span class="opacity-70">${item.confidence}</span>
                </div>

                <div class="text-lg font-bold mb-3">${item.text}</div>

                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm opacity-80">
                    <div><div class="font-semibold">Date</div><div>${item.date}</div></div>
                    <div><div class="font-semibold">Country</div><div>${item.country || "-"}</div></div>
                    <div><div class="font-semibold">Language</div><div>${item.language}</div></div>
                    <div><div class="font-semibold">Category</div><div>${item.category}</div></div>
                    <div><div class="font-semibold">Publisher</div><div>${item.publisher}</div></div>
                </div>
            `;

            if(wrap) wrap.appendChild(card);
        });

    }catch(e){
        console.error("Sentiment error:",e);
    }
}


// ============================
// CORRELATION + AI ANALYSIS
// ============================
async function getPriceChange(coin){
    try{
        const res = await fetch("/api/prices");
        const json = await res.json();
        const wrap = handleApiWrapper(json);
        if(!wrap.ok) return 0;

        const found = wrap.data.find(c=>c.id===coin);
        return found ? found.price_change_percentage_24h : 0;
    }catch{ return 0; }
}

async function drawCorrelationChart(){
    try{
        const sentimentRes = await fetch("/api/sentiment");
        const newsArr = await sentimentRes.json();
        if(!Array.isArray(newsArr) || newsArr.length===0) return;

        const priceChange = await getPriceChange(currentCoin);

        const sentiments = newsArr.map(n=>n.confidence || 0);
        const priceChanges = newsArr.map(()=> priceChange);

        const avgSent = sentiments.reduce((a,b)=>a+b,0) / sentiments.length;
        const corr = (avgSent * priceChange) / 100;

        q("#correlation-score").textContent = corr.toFixed(2);

        const pos = newsArr.filter(n=>n.sentiment==="positive").length;
        const neg = newsArr.filter(n=>n.sentiment==="negative").length;

        q("#trending-sentiment").textContent = pos>=neg ? "Positif" : "Negatif";
        q("#price-trend").textContent = priceChange>=0 ? "Naik" : "Turun";

        Plotly.newPlot("correlation-chart", [{
            x: sentiments,
            y: priceChanges,
            mode:"markers",
            type:"scatter",
            marker:{size:10, color:"#38bdf8"}
        }], {
            paper_bgcolor:"#0b0f19",
            plot_bgcolor:"#0b0f19",
            xaxis:{title:"Sentiment Score", color:"#ccc"},
            yaxis:{title:"Price Change (24h)", color:"#ccc"},
            margin:{t:40, l:50, r:20, b:50}
        });

        // AI analysis output (only if exists in HTML)
        const aiBox = q("#ai-analysis");
        if(aiBox){
            aiBox.textContent = generateAIAnalysis(
                priceChange,
                pos>=neg ? "Positif" : "Negatif",
                corr
            );
        }

    }catch(e){
        console.error("Correlation error:",e);
    }
}


function generateAIAnalysis(priceChange, trend, corr){
    let txt = "";

    txt += trend==="Positif"
        ? "Sentimen pasar saat ini cenderung positif. "
        : trend==="Negatif"
        ? "Sentimen pasar cenderung negatif. "
        : "Sentimen berada pada zona netral. ";

    txt += priceChange>0
        ? "Harga menunjukkan tanda-tanda penguatan. "
        : priceChange<0
        ? "Harga sedang melemah. "
        : "Pergerakan harga relatif stabil. ";

    if(corr>0.5) txt += "Sentimen memiliki pengaruh kuat terhadap harga.";
    else if(corr<-0.5) txt += "Sentimen berlawanan arah dengan harga.";
    else txt += "Korelasi sentimen terhadap harga masih lemah.";

    return txt;
}

// ============================
// SENTIMENT vs PRICE REAL-TIME CHART
// ============================
async function drawSentimentPriceChart() {
    try {
        // Ambil data sentimen
        const sentimentRes = await fetch("/api/sentiment");
        const sentimentArr = await sentimentRes.json();

        if (!Array.isArray(sentimentArr) || sentimentArr.length === 0) return;

        // Ambil harga coin aktif (default BTC)
        const priceRes = await fetch("/api/prices");
        const priceJson = await priceRes.json();
        const wrap = handleApiWrapper(priceJson);

        if (!wrap.ok) return;

        const found = wrap.data.find(c => c.id === currentCoin) || wrap.data[0];
        const currentPrice = found.current_price;

        // --- Generate data ---
        const timestamps = sentimentArr.map((n, i) => `News ${i + 1}`);
        const sentimentScores = sentimentArr.map(n => n.confidence);
        const priceLine = sentimentArr.map(() => currentPrice);

        const T = getThemeColors();

        const traceSentiment = {
            x: timestamps,
            y: sentimentScores,
            type: "bar",
            name: "Sentiment Score",
            marker: { color: "#38bdf8" },
            opacity: 0.8,
        };

        const tracePrice = {
            x: timestamps,
            y: priceLine,
            type: "scatter",
            mode: "lines",
            name: "Harga Coin",
            yaxis: "y2",
            line: { color: "#ff4b4b", width: 2 },
        };

        const layout = {
            paper_bgcolor: T.bg,
            plot_bgcolor: T.bg,
            margin: { t: 40, b: 40, l: 50, r: 50 },
            xaxis: {
                tickfont: { color: T.text },
                gridcolor: T.grid,
            },
            yaxis: {
                title: "Sentiment Score",
                tickfont: { color: T.text },
                gridcolor: T.grid,
            },
            yaxis2: {
                title: "Harga Coin (USD)",
                overlaying: "y",
                side: "right",
                tickprefix: "$",
                tickfont: { color: T.text },
            },
            showlegend: true,
            legend: {
                font: { color: T.text }
            }
        };

        Plotly.newPlot("sentiment-price-chart", [traceSentiment, tracePrice], layout, { responsive: true });

    } catch (e) {
        console.error("Sentiment vs Price chart error:", e);
    }
}


// ============================
// INIT
// ============================
async function init(){
    fetchPrices();
    fetchChart("bitcoin",1);
    fetchSentiment();
    drawCorrelationChart();
    drawSentimentPriceChart();

    setInterval(fetchPrices, 300000);
    
}

init();

})();
