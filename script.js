// ========================================================
// 1. استدعاء وتهيئة قاعدة بيانات Firebase
// ========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCi53RaZ7FsNJZUIRPCCVnXqGAfwpYt0NA",
    authDomain: "jsjsheh-481ad.firebaseapp.com",
    projectId: "jsjsheh-481ad",
    storageBucket: "jsjsheh-481ad.firebasestorage.app",
    messagingSenderId: "364314986023",
    appId: "1:364314986023:web:3717d5663cf288cd07f002",
    measurementId: "G-5XV7FT2FX3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const defaultSettings = {
    siteName: "موقع الخصومات",
    logo: "https://cdn-icons-png.flaticon.com/512/3170/3170733.png"
};
const PUSHY_APP_ID = "6a2b4357a8bcff6c5eaec578";
const PUSHY_ORDER_TOPIC = "admin-orders";

function readLocalCache(key, fallback = []) {
    try {
        if(typeof localStorage === "undefined") return fallback;
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (error) {
        return fallback;
    }
}

function writeLocalCache(key, value) {
    try {
        if(typeof localStorage !== "undefined") {
            localStorage.setItem(key, JSON.stringify(value));
        }
    } catch (error) {
        console.warn("Cache write skipped:", key);
    }
}

// ========================================================
// 2. نظام تسجيل الدخول والتبويبات
// ========================================================
window.checkPassword = function() {
    const pass = document.getElementById('admin-password').value;
    if(pass === '1001') {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('admin-screen').style.display = 'block';
        loadCategories();
        loadProducts();
        loadOrders();
        loadSettings();
        updatePushyStatus();
    } else {
        alert("كلمة المرور غير صحيحة!");
    }
}

window.logout = function() {
    document.getElementById('admin-password').value = "";
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('admin-screen').style.display = 'none';
}

window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');

    const tabMap = {
        categories: 1,
        products: 2,
        orders: 3,
        settings: 4
    };

    document.querySelector(`.tabs button:nth-child(${tabMap[tabName] || 1})`).classList.add('active');
    document.getElementById(`${tabName}-tab`).style.display = 'block';

    if(tabName === "orders") loadOrders();
}

// ========================================================
// 3. إعدادات الموقع
// ========================================================
async function loadSettings() {
    const savedLocal = JSON.parse(localStorage.getItem("siteSettings") || "{}");
    let settings = { ...defaultSettings, ...savedLocal };

    applySettingsForm(settings);

    try {
        const settingsSnap = await getDoc(doc(db, "settings", "general"));
        if(settingsSnap.exists()) {
            settings = { ...settings, ...settingsSnap.data() };
            localStorage.setItem("siteSettings", JSON.stringify(settings));
        }
    } catch (error) {
        console.error("Settings load error:", error);
    }

    applySettingsForm(settings);
}

function applySettingsForm(settings) {
    document.getElementById("site-name").value = settings.siteName;
    document.getElementById("site-logo-base64").value = settings.logo;
    document.getElementById("site-logo-preview").src = settings.logo;
    document.getElementById("site-name-preview").innerText = settings.siteName;
}

window.previewSiteLogo = function(event) {
    const file = event.target.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function(e) {
        const img = new Image();
        img.src = e.target.result;
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const MAX_WIDTH = 400;
            let width = img.width;
            let height = img.height;

            if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.78);
            document.getElementById("site-logo-base64").value = compressedDataUrl;
            document.getElementById("site-logo-preview").src = compressedDataUrl;
        };
    };
}

window.saveSettings = async function() {
    const siteName = document.getElementById("site-name").value.trim();
    const logo = document.getElementById("site-logo-base64").value || defaultSettings.logo;

    if(!siteName) return alert("اكتب اسم الموقع أولاً");

    const settings = { siteName, logo };
    const btn = document.querySelector(".settings-save");
    const oldText = btn.innerHTML;
    btn.innerHTML = "جاري الحفظ...";
    btn.disabled = true;

    try {
        await setDoc(doc(db, "settings", "general"), settings, { merge: true });
        localStorage.setItem("siteSettings", JSON.stringify(settings));
        document.getElementById("site-name-preview").innerText = siteName;
        alert("تم حفظ الإعدادات بنجاح");
    } catch (error) {
        console.error("Settings save error:", error);
        alert("حدث خطأ أثناء حفظ الإعدادات");
    }

    btn.innerHTML = oldText;
    btn.disabled = false;
}

// ========================================================
// 4. إدارة الطلبات
// ========================================================
function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatOrderDate(value) {
    if(!value) return "غير محدد";
    const date = value.toDate ? value.toDate() : new Date(value);
    if(Number.isNaN(date.getTime())) return "غير محدد";
    return date.toLocaleString("ar-IQ");
}

async function loadOrders() {
    const ordersList = document.getElementById("orders-list");
    if(!ordersList) return;

    ordersList.innerHTML = '<p class="empty-orders">جاري تحميل الطلبات...</p>';

    try {
        const querySnapshot = await getDocs(collection(db, "orders"));
        const orders = [];
        querySnapshot.forEach((docSnap) => {
            orders.push({ id: docSnap.id, ...docSnap.data() });
        });

        orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        const activeOrders = orders.filter(order => order.status !== "confirmed");

        if(activeOrders.length === 0) {
            ordersList.innerHTML = '<p class="empty-orders">لا توجد طلبات حالية.</p>';
            return;
        }

        ordersList.innerHTML = activeOrders.map(order => renderOrderCard(order)).join("");
    } catch (error) {
        console.error("Orders load error:", error);
        ordersList.innerHTML = '<p class="empty-orders">حدث خطأ أثناء تحميل الطلبات.</p>';
    }
}

function renderOrderCard(order) {
    const items = Array.isArray(order.items) ? order.items : [];
    const siteLink = order.siteLink || "";
    const itemsHtml = items.map(item => `
        <div class="order-item">
            <img src="${escapeHtml(item.img || "")}" alt="${escapeHtml(item.title || "منتج")}">
            <div>
                <strong>${escapeHtml(item.title)}</strong>
                <span>الكمية: ${Number(item.quantity || item.qty || 1).toLocaleString("ar-IQ")}</span>
                <span>السعر: ${Number(item.price || 0).toLocaleString("ar-IQ")} د.ع</span>
                <small>${escapeHtml(item.desc || item.category || "")}</small>
            </div>
        </div>
    `).join("");

    return `
        <article class="order-card">
            <div class="order-card-head">
                <div>
                    <h4>${escapeHtml(order.customer || "زبون")}</h4>
                    <span>${formatOrderDate(order.createdAt)}</span>
                </div>
                <span class="order-status">${order.status === "confirmed" ? "مؤكد" : "جديد"}</span>
            </div>
            <div class="order-details">
                <p><strong>الهاتف:</strong> ${escapeHtml(order.phone)}</p>
                <p><strong>المجموع:</strong> ${Number(order.total || 0).toLocaleString("ar-IQ")} د.ع</p>
                <p><strong>رابط الموقع:</strong> ${siteLink ? `<a href="${escapeHtml(siteLink)}" target="_blank" rel="noopener">${escapeHtml(siteLink)}</a>` : "غير متوفر"}</p>
            </div>
            <div class="order-items">${itemsHtml}</div>
            <div class="order-actions">
                <button class="action-btn add" onclick="confirmOrder('${order.id}')"><i class="fa-solid fa-check"></i> تأكيد</button>
                <button class="action-btn delete" onclick="deleteOrder('${order.id}')"><i class="fa-solid fa-trash"></i> حذف</button>
            </div>
        </article>
    `;
}

window.loadOrders = loadOrders;

window.confirmOrder = async function(id) {
    try {
        await updateDoc(doc(db, "orders", id), {
            status: "confirmed",
            confirmedAt: new Date().toISOString()
        });
        loadOrders();
    } catch (error) {
        alert("حدث خطأ أثناء تأكيد الطلب");
    }
}

window.deleteOrder = async function(id) {
    if(confirm("هل تريد حذف هذا الطلب؟")) {
        try {
            await deleteDoc(doc(db, "orders", id));
            loadOrders();
        } catch (error) {
            alert("حدث خطأ أثناء حذف الطلب");
        }
    }
}

function updatePushyStatus(message) {
    const status = document.getElementById("pushy-status");
    if(!status) return;

    if(message) {
        status.innerText = message;
        return;
    }

    if(!("Notification" in window)) {
        status.innerText = "هذا المتصفح لا يدعم الإشعارات.";
        return;
    }

    if(window.Pushy && Pushy.isRegistered && Pushy.isRegistered()) {
        status.innerText = "الإشعارات مفعلة لهذا المتصفح.";
        return;
    }

    if(Notification.permission === "denied") {
        status.innerText = "الإشعارات مرفوضة من إعدادات المتصفح. فعّلها من إعدادات الموقع.";
        return;
    }

    status.innerText = "فعّل الإشعارات حتى تصلك الطلبات من الأعلى حتى لو لوحة الأدمن مغلقة.";
}

window.enableOrderNotifications = async function() {
    const btn = document.querySelector(".notification-btn");
    const oldText = btn ? btn.innerHTML : "";
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = "جاري التفعيل...";
    }

    try {
        if(!window.Pushy) throw new Error("Pushy SDK لم يتم تحميله بعد");

        const deviceToken = await Pushy.register({
            appId: PUSHY_APP_ID,
            serviceWorkerFilename: "service-worker.js"
        });

        if(Pushy.subscribe) {
            await Pushy.subscribe(PUSHY_ORDER_TOPIC);
        }

        localStorage.setItem("pushyAdminToken", deviceToken);
        await setDoc(doc(db, "notificationDevices", deviceToken), {
            token: deviceToken,
            topic: PUSHY_ORDER_TOPIC,
            enabledAt: new Date().toISOString(),
            userAgent: navigator.userAgent
        }, { merge: true });

        if(Pushy.setNotificationListener) {
            Pushy.setNotificationListener(function(data) {
                loadOrders();
                if(data && data.message) {
                    console.log("Order notification:", data.message);
                }
            });
        }

        updatePushyStatus("تم تفعيل الإشعارات لهذا المتصفح بنجاح.");
    } catch (error) {
        console.error("Pushy registration error:", error);
        updatePushyStatus("تعذر تفعيل الإشعارات: " + error.message);
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = oldText;
        }
    }
}

// ========================================================
// 3. إدارة التصنيفات
// ========================================================
let categoriesList = []; // مصفوفة لحفظ التصنيفات

async function loadCategories() {
    const listElement = document.getElementById('categories-list');
    const selectElement = document.getElementById('prod-category');
    listElement.innerHTML = '<tr><td colspan="2" style="text-align:center;">جاري التحميل...</td></tr>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "categories"));
        categoriesList = [];
        listElement.innerHTML = "";
        selectElement.innerHTML = "";

        querySnapshot.forEach((doc) => {
            let cat = { id: doc.id, name: doc.data().name };
            categoriesList.push(cat);
            
            // إضافة للجدول
            listElement.innerHTML += `
                <tr>
                    <td>${cat.name}</td>
                    <td>
                        <button class="action-btn edit" onclick="editCategory('${cat.id}', '${cat.name}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="action-btn delete" onclick="deleteCategory('${cat.id}')"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
            // إضافة لقائمة اختيار المنتجات
            selectElement.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
        });

        if(categoriesList.length === 0) listElement.innerHTML = '<tr><td colspan="2" style="text-align:center;">لا توجد تصنيفات، أضف واحداً الآن.</td></tr>';

    } catch (error) {
        console.error("خطأ:", error);
    }
}

window.saveCategory = async function() {
    const catName = document.getElementById('cat-name').value.trim();
    if(!catName) return alert("الرجاء كتابة اسم التصنيف");

    document.querySelector('.add-box button').disabled = true;
    try {
        await addDoc(collection(db, "categories"), { name: catName });
        document.getElementById('cat-name').value = "";
        loadCategories();
    } catch (error) {
        alert("حدث خطأ أثناء الحفظ");
    }
    document.querySelector('.add-box button').disabled = false;
}

window.deleteCategory = async function(id) {
    if(confirm("هل أنت متأكد من حذف هذا التصنيف؟")) {
        try {
            await deleteDoc(doc(db, "categories", id));
            loadCategories();
        } catch (error) {
            alert("حدث خطأ أثناء الحذف");
        }
    }
}

window.editCategory = async function(id, oldName) {
    let newName = prompt("تعديل اسم التصنيف:", oldName);
    if(newName && newName.trim() !== "") {
        try {
            await updateDoc(doc(db, "categories", id), { name: newName.trim() });
            loadCategories();
            // ملاحظة: لجعل التصنيف يتغير داخل الوجبات القديمة يتطلب تحديث الوجبات، سنكتفي هنا بتحديث اسم التصنيف فقط لسهولة الكود.
        } catch(error) {
            alert("حدث خطأ في التعديل");
        }
    }
}

// ========================================================
// 4. إدارة المنتجات
// ========================================================

let productRows = [];
let productsUnsubscribe = null;

function getProductSortValue(item, index) {
    return Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index;
}

function sortProducts(products) {
    return products.sort((a, b) => {
        const sortDiff = getProductSortValue(a, 0) - getProductSortValue(b, 0);
        if(sortDiff !== 0) return sortDiff;
        return String(a.title || "").localeCompare(String(b.title || ""), "ar");
    });
}

function renderProductsTable(products) {
    const listElement = document.getElementById('products-list');
    if(!listElement) return;

    productRows = sortProducts([...products]);
    listElement.innerHTML = "";

    productRows.forEach((item, index) => {
        const itemJSON = encodeURIComponent(JSON.stringify(item));
        listElement.innerHTML += `
            <tr class="product-row" draggable="true" data-product-id="${item.id}">
                <td class="drag-cell">
                    <button class="drag-handle" type="button" title="اسحب لتغيير الترتيب">
                        <i class="fa-solid fa-grip-lines"></i>
                    </button>
                    <span class="sort-number">${index + 1}</span>
                </td>
                <td><img src="${item.img}" class="product-img-cell" alt="صورة"></td>
                <td>${item.title}</td>
                <td>${item.category}</td>
                <td>${Number(item.price).toLocaleString()} د.ع</td>
                <td>
                    <button class="action-btn edit" onclick="editProduct('${itemJSON}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn delete" onclick="deleteProduct('${item.id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });

    if(productRows.length === 0) {
        listElement.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد منتجات حالياً.</td></tr>';
    } else {
        setupProductDragSorting();
    }
}

async function loadProducts() {
    const listElement = document.getElementById('products-list');
    const cachedProducts = readLocalCache("adminProductsCache", []);

    if(cachedProducts.length > 0) {
        renderProductsTable(cachedProducts);
    } else {
        listElement.innerHTML = '<tr><td colspan="6" style="text-align:center;">جاري التحميل...</td></tr>';
    }

    if(productsUnsubscribe) return;

    productsUnsubscribe = onSnapshot(collection(db, "menuItems"), (querySnapshot) => {
        const freshProducts = [];
        querySnapshot.forEach((docSnap) => {
            freshProducts.push({ id: docSnap.id, ...docSnap.data() });
        });

        writeLocalCache("adminProductsCache", freshProducts);
        renderProductsTable(freshProducts);
    }, (error) => {
        console.error("Products listener error:", error);
        if(cachedProducts.length === 0) {
            listElement.innerHTML = '<tr><td colspan="6" style="text-align:center;">تعذر تحميل المنتجات.</td></tr>';
        }
    });

    setTimeout(async () => {
        if(productRows.length > 0) return;
        try {
            const querySnapshot = await getDocs(collection(db, "menuItems"));
            const fallbackProducts = [];
            querySnapshot.forEach((docSnap) => {
                fallbackProducts.push({ id: docSnap.id, ...docSnap.data() });
            });
            writeLocalCache("adminProductsCache", fallbackProducts);
            renderProductsTable(fallbackProducts);
        } catch (error) {
            console.error("Products fallback error:", error);
        }
    }, 1800);
}

function setupProductDragSorting() {
    const rows = document.querySelectorAll("#products-list .product-row");

    rows.forEach(row => {
        row.addEventListener("dragstart", () => {
            row.classList.add("dragging");
        });

        row.addEventListener("dragend", () => {
            row.classList.remove("dragging");
            saveProductOrderFromTable();
        });

        row.addEventListener("dragover", (event) => {
            event.preventDefault();
            const tbody = document.getElementById("products-list");
            const dragging = tbody.querySelector(".dragging");
            const target = event.currentTarget;
            if(!dragging || dragging === target) return;

            const targetRect = target.getBoundingClientRect();
            const shouldInsertAfter = event.clientY > targetRect.top + targetRect.height / 2;
            tbody.insertBefore(dragging, shouldInsertAfter ? target.nextSibling : target);
            updateProductSortNumbers();
        });
    });
}

function updateProductSortNumbers() {
    document.querySelectorAll("#products-list .product-row").forEach((row, index) => {
        const number = row.querySelector(".sort-number");
        if(number) number.innerText = index + 1;
    });
}

async function saveProductOrderFromTable() {
    const rows = Array.from(document.querySelectorAll("#products-list .product-row"));
    try {
        await Promise.all(rows.map((row, index) => {
            return updateDoc(doc(db, "menuItems", row.dataset.productId), { sortOrder: index });
        }));
    } catch (error) {
        console.error("Product order save error:", error);
        alert("حدث خطأ أثناء حفظ ترتيب المنتجات");
    }
}

window.openProductModal = function() {
    if(categoriesList.length === 0) return alert("يجب إضافة تصنيف واحد على الأقل قبل إضافة المنتجات!");
    
    document.getElementById('modal-title').innerText = "إضافة منتج جديد";
    document.getElementById('prod-id').value = "";
    document.getElementById('prod-title').value = "";
    document.getElementById('prod-desc').value = "";
    document.getElementById('prod-price').value = "";
    document.getElementById('prod-image').value = "";
    document.getElementById('prod-base64').value = "";
    document.getElementById('image-preview').style.display = "none";
    document.getElementById('image-preview').src = "";
    
    document.getElementById('product-modal').classList.add('show');
}

window.closeProductModal = function() {
    document.getElementById('product-modal').classList.remove('show');
}

window.deleteProduct = async function(id) {
    if(confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
        try {
            await deleteDoc(doc(db, "menuItems", id));
            loadProducts();
        } catch (error) {
            alert("حدث خطأ أثناء الحذف");
        }
    }
}

window.editProduct = function(encodedItem) {
    let item = JSON.parse(decodeURIComponent(encodedItem));
    
    document.getElementById('modal-title').innerText = "تعديل المنتج";
    document.getElementById('prod-id').value = item.id;
    document.getElementById('prod-title').value = item.title;
    document.getElementById('prod-desc').value = item.desc;
    document.getElementById('prod-price').value = item.price;
    document.getElementById('prod-category').value = item.category;
    document.getElementById('prod-base64').value = item.img;
    
    document.getElementById('image-preview').src = item.img;
    document.getElementById('image-preview').style.display = "inline-block";
    document.getElementById('prod-image').value = ""; // تصفير حقل رفع الصورة
    
    document.getElementById('product-modal').classList.add('show');
}

window.saveProduct = async function() {
    const id = document.getElementById('prod-id').value;
    const title = document.getElementById('prod-title').value.trim();
    const desc = document.getElementById('prod-desc').value.trim();
    const price = document.getElementById('prod-price').value.trim();
    const category = document.getElementById('prod-category').value;
    const imgBase64 = document.getElementById('prod-base64').value;

    if(!title || !desc || !price || !category || !imgBase64) {
        return alert("الرجاء تعبئة جميع الحقول وإدراج صورة!");
    }

    const productData = {
        title: title,
        desc: desc,
        price: Number(price),
        category: category,
        img: imgBase64,
        sortOrder: id === "" ? productRows.length : getProductSortValue(productRows.find(item => item.id === id) || {}, productRows.length)
    };

    const btn = document.querySelector('.modal-actions .save');
    btn.innerHTML = "جاري الحفظ..."; btn.disabled = true;

    try {
        if(id === "") {
            // إضافة جديد
            await addDoc(collection(db, "menuItems"), productData);
        } else {
            // تعديل موجود
            await updateDoc(doc(db, "menuItems", id), productData);
        }
        closeProductModal();
        loadProducts();
    } catch (error) {
        alert("حدث خطأ أثناء الحفظ!");
    }
    
    btn.innerHTML = "حفظ المنتج"; btn.disabled = false;
}

// ========================================================
// 5. ضغط وتحويل الصورة إلى رابط Base64
// ========================================================
window.compressImage = function(event) {
    const file = event.target.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function(e) {
        const img = new Image();
        img.src = e.target.result;
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // تحديد أقصى عرض لتقليص الحجم مع الحفاظ على الجودة العالية للموبايل
            const MAX_WIDTH = 600; 
            let width = img.width;
            let height = img.height;

            if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            // تحويل إلى Base64 بنوع jpeg وجودة 70% لتقليل المساحة بقوة
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            
            // حفظ الرابط في المتغير المخفي وعرض المعاينة
            document.getElementById('prod-base64').value = compressedDataUrl;
            document.getElementById('image-preview').src = compressedDataUrl;
            document.getElementById('image-preview').style.display = "inline-block";
        }
    }
}
