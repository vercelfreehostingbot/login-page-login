const translations={
en:{brand:"Test Portal",loginTitle:"Welcome back",loginSubtitle:"Sign in to test the dashboard.",email:"Email",password:"Password",login:"Login",language:"Language",dashboard:"Dashboard",logout:"Logout",online:"ONLINE",hello:"Hello",ready:"Your test dashboard is ready.",users:"Users",tasks:"Tasks",messages:"Messages",quickActions:"Quick Actions",newTask:"＋ New Task",profile:"👤 Profile",settings:"⚙ Settings",status:"Bot Test Status",working:"Working",statusText:"This is a front-end-only test page. Nothing is connected."},
bn:{brand:"টেস্ট পোর্টাল",loginTitle:"আবার স্বাগতম",loginSubtitle:"ড্যাশবোর্ড টেস্ট করতে লগইন করুন।",email:"ইমেইল",password:"পাসওয়ার্ড",login:"লগইন",language:"ভাষা",dashboard:"ড্যাশবোর্ড",logout:"লগআউট",online:"অনলাইন",hello:"হ্যালো",ready:"আপনার টেস্ট ড্যাশবোর্ড প্রস্তুত।",users:"ব্যবহারকারী",tasks:"টাস্ক",messages:"মেসেজ",quickActions:"দ্রুত কাজ",newTask:"＋ নতুন টাস্ক",profile:"👤 প্রোফাইল",settings:"⚙ সেটিংস",status:"বট টেস্ট স্ট্যাটাস",working:"চলছে",statusText:"এটি শুধু ফ্রন্টএন্ড টেস্ট পেজ। কোনো কিছু কানেক্ট করা নেই।"},
hi:{brand:"टेस्ट पोर्टल",loginTitle:"वापसी पर स्वागत है",loginSubtitle:"डैशबोर्ड टेस्ट करने के लिए लॉगिन करें।",email:"ईमेल",password:"पासवर्ड",login:"लॉगिन",language:"भाषा",dashboard:"डैशबोर्ड",logout:"लॉगआउट",online:"ऑनलाइन",hello:"नमस्ते",ready:"आपका टेस्ट डैशबोर्ड तैयार है।",users:"यूज़र्स",tasks:"टास्क",messages:"मैसेज",quickActions:"त्वरित कार्य",newTask:"＋ नया टास्क",profile:"👤 प्रोफ़ाइल",settings:"⚙ सेटिंग्स",status:"बॉट टेस्ट स्टेटस",working:"काम कर रहा है",statusText:"यह केवल फ्रंटएंड टेस्ट पेज है। कुछ भी कनेक्ट नहीं है।"},
ar:{brand:"بوابة الاختبار",loginTitle:"مرحباً بعودتك",loginSubtitle:"سجّل الدخول لاختبار لوحة التحكم.",email:"البريد الإلكتروني",password:"كلمة المرور",login:"تسجيل الدخول",language:"اللغة",dashboard:"لوحة التحكم",logout:"تسجيل الخروج",online:"متصل",hello:"مرحباً",ready:"لوحة الاختبار جاهزة.",users:"المستخدمون",tasks:"المهام",messages:"الرسائل",quickActions:"إجراءات سريعة",newTask:"＋ مهمة جديدة",profile:"👤 الملف الشخصي",settings:"⚙ الإعدادات",status:"حالة اختبار البوت",working:"يعمل",statusText:"هذه صفحة اختبار للواجهة فقط. لا يوجد أي اتصال."}
};

function applyLanguage(lang){
  const t=translations[lang]||translations.en;
  document.documentElement.lang=lang;
  document.body.classList.toggle("rtl",lang==="ar");
  document.querySelectorAll("[data-i18n]").forEach(el=>{el.textContent=t[el.dataset.i18n]||el.textContent});
  document.getElementById("language").value=lang;
  document.getElementById("language2").value=lang;
  localStorage.setItem("testLang",lang);
}
function login(){
  const email=document.getElementById("email").value.trim();
  const pass=document.getElementById("password").value.trim();
  const msg=document.getElementById("loginMsg");
  if(!email||!pass){msg.textContent="Please enter email and password.";return}
  document.getElementById("userName").textContent=email.split("@")[0]||"User";
  document.getElementById("loginPage").classList.add("hidden");
  document.getElementById("dashboardPage").classList.remove("hidden");
  msg.textContent="";
}
function logout(){
  document.getElementById("dashboardPage").classList.add("hidden");
  document.getElementById("loginPage").classList.remove("hidden");
}
document.getElementById("loginBtn").onclick=login;
document.getElementById("logoutBtn").onclick=logout;
document.getElementById("language").onchange=e=>applyLanguage(e.target.value);
document.getElementById("language2").onchange=e=>applyLanguage(e.target.value);
document.getElementById("password").addEventListener("keydown",e=>{if(e.key==="Enter")login()});
applyLanguage(localStorage.getItem("testLang")||"en");