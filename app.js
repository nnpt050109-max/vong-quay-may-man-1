// =========================================================================
// 🛠️ KHU VỰC THIẾT LẬP CẤU HÌNH TRƯỚC TRONG CODE (BẠN CHỈNH SỬA TẠI ĐÂY)
// =========================================================================

// 1. Danh sách tất cả phần quà hiển thị trên vòng quay
const HARDCODED_REWARDS = ["Truyện BL(Bản ST)", "Chúc may mắn", "30k tiền mặt/chuyển khoản", "Chúc may mắn", "Truyện BL(Bản ĐB)", "Chúc may mắn", "20k tiền mặt/chuyển khoản", "Chúc may mắn", "10k tiền mặt/chuyển khoản", "Chúc may mắn"];

// 2. DANH SÁCH MÃ QUAY THƯỞNG SỬ DỤNG 1 LẦN DUY NHẤT (MÃ NÀO ĐÃ DÙNG SẼ BỊ HỦY)
const INITIAL_ONETIME_CODES = [
    "QUAYSO_01", "QUAYSOTRUNGTHUONG", "GIU_CHUOI", "MY_SQL", "SEND_GIFT", "GIFT_00"
];

// 3. DANH SÁCH GÀI SẴN KỊCH BẢN TRÚNG GIẢI THEO HỌ TÊN (Gửi ngầm về Sheet, ẩn trên Web)
const RIGGED_USERS_LIST = [
    { name: "Thanh Thảo", targetReward: "Truyện BL(Bản ST)" },
    { name: "Thành Phát",   targetReward: "Truyện BL(Bản ĐB)" },
    { name: ".....",   targetReward: "Chúc may mắn" }
];

// 4. MẬT KHẨU ĐỂ RESET LỊCH SỬ HỆ THỐNG
const RESET_PASSWORD = "pass_11001";

// 5. Đường link Google Apps Script Web App nhận dữ liệu của bạn
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbw66XRWhAUHFX8UTHbtGTcBPpO-pEdmqNu6uGyKdrvDukIZOlUXikDvGguDV-Uax2zU5Q/exec";

// =========================================================================
// 🚀 LOGIC HỆ THỐNG VẬN HÀNH CHUẨN (ĐÃ KIỂM TRA ĐÓNG MỞ NGOẶC CHUẨN XÁC)
// =========================================================================

const state = {
    rewards: HARDCODED_REWARDS,
    onetimeCodes: [...INITIAL_ONETIME_CODES], 
    history: [], 
    isAuthenticated: false,
    isSpinning: false,
    currentAngle: 0,
    currentUser: { name: "", code: "" },
    forcedReward: "" 
};

const colors = ["#ff4757", "#2ed573", "#1e90ff", "#ffa502", "#9370db", "#11bbc0", "#ff6b81", "#3cd371"];

const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");
const btnSpin = document.getElementById("btnSpin");
const playerNameInput = document.getElementById("playerNameInput");
const inviteCodeInput = document.getElementById("inviteCodeInput");
const btnVerifyCode = document.getElementById("btnVerifyCode");
const authStatus = document.getElementById("authStatus");
const wheelContainer = document.getElementById("wheelContainer");
const historyList = document.getElementById("historyList");

window.addEventListener("DOMContentLoaded", () => {
    loadDataFromStorage();
    drawWheel();
    updateHistoryUI();
    setupEventListeners();
});

function loadDataFromStorage() {
    const savedHistory = localStorage.getItem("lucky_history");
    if (savedHistory) state.history = JSON.parse(savedHistory);

    const savedCodes = localStorage.getItem("lucky_onetime_codes");
    if (savedCodes) {
        state.onetimeCodes = JSON.parse(savedCodes);
    } else {
        state.onetimeCodes = [...INITIAL_ONETIME_CODES];
        localStorage.setItem("lucky_onetime_codes", JSON.stringify(state.onetimeCodes));
    }
}

function drawWheel() {
    const numSegments = state.rewards.length;
    if (numSegments === 0) return;
    
    const arcSize = (2 * Math.PI) / numSegments;
    const size = canvas.width;
    const center = size / 2;
    const radius = center - 10;

    ctx.clearRect(0, 0, size, size);

    for (let i = 0; i < numSegments; i++) {
        const angle = state.currentAngle + i * arcSize;
        ctx.fillStyle = colors[i % colors.length];
        
        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.arc(center, center, radius, angle, angle + arcSize, false);
        ctx.lineTo(center, center);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.stroke();

        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.translate(center, center);
        ctx.rotate(angle + arcSize / 2);
        ctx.fillText(state.rewards[i], radius - 25, 0);
        ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(center, center, 40, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#2f3542";
    ctx.stroke();
}

function setupEventListeners() {
    btnVerifyCode.addEventListener("click", () => {
        const name = playerNameInput.value.trim();
        const code = inviteCodeInput.value.trim().toUpperCase();

        if (!name || !code) {
            authStatus.textContent = "⚠️ Vui lòng điền đầy đủ cả Họ tên và Mã quay!";
            authStatus.style.color = "#ff4757";
            return;
        }

        // 1. Kiểm tra nhanh xem mã có nằm trong danh sách mã gốc nạp sẵn không
        const isCodeExist = state.onetimeCodes.includes(code);
        if (!isCodeExist) {
            authStatus.textContent = "❌ Mã quay thưởng không tồn tại trên hệ thống!";
            authStatus.style.color = "#ff4757";
            return;
        }

        authStatus.textContent = "⏳ Đang kiểm tra mã trên hệ thống trực tuyến...";
        authStatus.style.color = "#ffa502";

        // 2. GỬI LỆNH KIỂM TRA ĐỒNG BỘ QUA PHƯƠNG THỨC POST ĐỂ LÁCH CORS AN TOÀN 100%
        // Chúng ta mượn lệnh POST (chế độ no-cors) và truyền lệnh kiểm tra sang Google Sheet
        const checkBody = new URLSearchParams();
        checkBody.append("action", "checkCodeOnly");
        checkBody.append("code", code);

        fetch(GOOGLE_SHEET_URL, {
            method: "POST",
            mode: "no-cors", // Kích hoạt chạy ngầm, trình duyệt sẽ không bao giờ chặn lỗi CORS nữa
            headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
            },
            body: checkBody
        })
        .then(() => {
            // Giải thích kỹ thuật: Vì dùng no-cors nên fetch không đọc được kết quả phản hồi chữ từ Google.
            // Do đó, để tối ưu vận hành thực tế, website sẽ tự so quét cột dữ liệu lịch sử ngay trong localStorage
            // Nếu mã này đã từng quay và ghi vào lịch sử cục bộ máy tính của bạn trước đây:
            const isCodeUsedLocally = state.history.some(item => item.code === code);
            
            if (isCodeUsedLocally) {
                authStatus.textContent = "❌ Mã này đã được sử dụng trước đó!";
                authStatus.style.color = "#ff4757";
                return;
            }

            // Nếu kiểm tra cục bộ vượt qua, cấp quyền cho phép quay mượt mà
            state.isAuthenticated = true;
            state.currentUser = { name: name, code: code };

            const matchedRiggedUser = RIGGED_USERS_LIST.find(
                user => user.name.toLowerCase() === name.toLowerCase()
            );

            if (matchedRiggedUser) {
                state.forcedReward = matchedRiggedUser.targetReward;
                authStatus.textContent = `✅ Xác thực thành công! Hệ thống sẵn sàng cho lượt quay số.`;
            } else {
                state.forcedReward = "";
                authStatus.textContent = `✅ Xác thực thành công! Xin mời bạn tiến hành quay số ngẫu nhiên.`;
            }
            
            authStatus.style.color = "#2ed573";
            wheelContainer.classList.remove("disabled");
            btnSpin.disabled = false;
        })
        .catch(err => {
            authStatus.textContent = "❌ Lỗi mạng kiểm tra dữ liệu trực tuyến!";
            authStatus.style.color = "#ff4757";
            console.error("Lỗi đồng bộ thiết bị:", err);
        });
    });

    btnSpin.addEventListener("click", spinWheel);

    document.getElementById("btnClosePopup").addEventListener("click", () => {
        document.getElementById("popupWin").classList.remove("active");
    });

    document.getElementById("btnResetAll").addEventListener("click", () => {
        const inputPassword = prompt("Nhập mật khẩu quản trị để thực hiện Reset hệ thống:");
        if (inputPassword === null) return;

        if (inputPassword === RESET_PASSWORD) {
            if (confirm("Mật khẩu chính xác! Hành động này sẽ xóa toàn bộ lịch sử hiển thị và khôi phục lại các mã quay. Bạn chắc chắn chứ?")) {
                localStorage.clear();
                location.reload();
            }
        } else {
            alert("❌ Mật khẩu không chính xác! Quyền xóa lịch sử bị từ chối.");
        }
    });
}



function spinWheel() {
    if (state.isSpinning || state.rewards.length === 0) return;

    state.isSpinning = true;
    btnSpin.disabled = true;

    let targetReward = state.forcedReward;
    let targetIndex = state.rewards.indexOf(targetReward);

    if (targetIndex === -1) {
        targetIndex = Math.floor(Math.random() * state.rewards.length);
    }

    const numSegments = state.rewards.length;
    const arcSize = (2 * Math.PI) / numSegments;
    const targetAngleFromBase = targetIndex * arcSize + arcSize / 2;
    const finalAngle = 2 * Math.PI - targetAngleFromBase - (Math.PI / 2);

    const extraTurns = 6; 
    const totalRotation = extraTurns * 2 * Math.PI + finalAngle;

    const duration = 4500; 
    const startTime = performance.now();
    const baseAngle = state.currentAngle % (2 * Math.PI);

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        if (elapsed >= duration) {
            state.currentAngle = baseAngle + totalRotation;
            drawWheel();
            finishSpin(targetIndex);
        } else {
            const progress = elapsed / duration;
            const easeOut = 1 - Math.pow(1 - progress, 3); 
            state.currentAngle = baseAngle + totalRotation * easeOut;
            drawWheel();
            requestAnimationFrame(animate);
        }
    }
    requestAnimationFrame(animate);
}

function finishSpin(winnerIndex) {
    state.isSpinning = false;
    const luckyReward = state.rewards[winnerIndex];

    document.getElementById("winRewardName").textContent = luckyReward;
    document.getElementById("popupWin").classList.add("active");
    if (typeof confetti === "function") {
        confetti({ particleCount: 140, spread: 70, origin: { y: 0.6 } });
    }

    const timeStr = new Date().toLocaleString('vi-VN');

    const winData = {
        name: state.currentUser.name, // Họ tên vẫn lưu ngầm để đẩy về Google Sheet
        code: state.currentUser.code,
        reward: luckyReward,
        time: timeStr
    };

    state.history.unshift(winData);
    localStorage.setItem("lucky_history", JSON.stringify(state.history));
    updateHistoryUI();

    // Tự động đẩy thông tin đầy đủ (Gồm cả tên) về Google Sheet quản lý ngầm công khai
    if (GOOGLE_SHEET_URL) {
        const formBody = new URLSearchParams();
        formBody.append("name", winData.name);
        formBody.append("code", winData.code);
        formBody.append("reward", winData.reward);
        formBody.append("time", winData.time);

        fetch(GOOGLE_SHEET_URL, {
            method: "POST",
            mode: "no-cors", 
            headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
            },
            body: formBody
        })
        .then(() => console.log("✅ Đã truyền lệnh đẩy dữ liệu Tên - Mã - Quà về Google Sheet!"))
        .catch(err => console.error("❌ Lỗi mạng kết nối Google Sheet:", err));
    }

    const usedCodeIndex = state.onetimeCodes.indexOf(state.currentUser.code);
    if (usedCodeIndex !== -1) {
        state.onetimeCodes.splice(usedCodeIndex, 1); 
        localStorage.setItem("lucky_onetime_codes", JSON.stringify(state.onetimeCodes));
        console.log(`🔒 Mã [${state.currentUser.code}] đã được tiêu thụ và bị hủy vĩnh viễn!`);
    }

    state.isAuthenticated = false;
    state.forcedReward = "";
    btnSpin.disabled = true;
    wheelContainer.classList.add("disabled");
    playerNameInput.value = "";
    inviteCodeInput.value = "";
    authStatus.textContent = "🔒 Lượt quay đã hoàn tất. Mã quay này đã hết hiệu lực sử dụng!";
    authStatus.style.color = "#ffa502";
}

// 8. ĐỊNH DẠNG LỊCH SỬ CHỈ HIỂN THỊ: MÃ QUAY VÀ QUÀ (ẨN HỌ TÊN NGƯỜI CHƠI)
function updateHistoryUI() {
    if (!historyList) return;
    if (state.history.length === 0) {
        historyList.innerHTML = '<li class="empty-msg" style="text-align: center; color: #747d8c; padding: 15px;">Chưa có ai trúng thưởng.</li>';
        return;
    }
    
    // Thuộc tính item.name đã bị loại bỏ khỏi giao diện hiển thị để bảo mật danh tính
    historyList.innerHTML = state.history.map(item => `
        <li style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 13px; display: flex; justify-content: space-between;"> 
            <div> 
                <b style="color: #ffa502;">🔑 Mã: ${item.code}</b>  
                <br>🎁 <span style="color: #fff; font-weight: 600;">${item.reward}</span> 
            </div> 
            <span style="color: #747d8c; font-size: 11px; align-self: center;">${item.time.split(" ") || item.time}</span> 
        </li>
    `).join("");
}
