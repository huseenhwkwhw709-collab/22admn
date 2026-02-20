// ========================================================
// 1. استدعاء وتهيئة قاعدة بيانات Firebase
// ========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

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
    
    if(tabName === 'categories') {
        document.querySelector('.tabs button:nth-child(1)').classList.add('active');
        document.getElementById('categories-tab').style.display = 'block';
    } else {
        document.querySelector('.tabs button:nth-child(2)').classList.add('active');
        document.getElementById('products-tab').style.display = 'block';
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

async function loadProducts() {
    const listElement = document.getElementById('products-list');
    listElement.innerHTML = '<tr><td colspan="5" style="text-align:center;">جاري التحميل...</td></tr>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "menuItems"));
        listElement.innerHTML = "";
        let count = 0;

        querySnapshot.forEach((docSnap) => {
            count++;
            let item = docSnap.data();
            // تشفير البيانات لإرسالها لدالة التعديل بأمان
            let itemJSON = encodeURIComponent(JSON.stringify({id: docSnap.id, ...item}));
            
            listElement.innerHTML += `
                <tr>
                    <td><img src="${item.img}" class="product-img-cell" alt="صورة"></td>
                    <td>${item.title}</td>
                    <td>${item.category}</td>
                    <td>${Number(item.price).toLocaleString()} د.ع</td>
                    <td>
                        <button class="action-btn edit" onclick="editProduct('${itemJSON}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="action-btn delete" onclick="deleteProduct('${docSnap.id}')"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });

        if(count === 0) listElement.innerHTML = '<tr><td colspan="5" style="text-align:center;">لا توجد منتجات حالياً.</td></tr>';

    } catch (error) {
        console.error("خطأ:", error);
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
        img: imgBase64
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
