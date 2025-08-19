// --- admin.js DEBUG VERSION ---
console.log("Debug script started!");
alert("ไฟล์ admin.js ทำงานแล้ว!");

try {
    const SUPABASE_URL = 'https://kpsferwaplnkzrbqoghv.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwc2ZlcndhcGxua3pyYnFvZ2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1MTI1NjUsImV4cCI6MjA3MTA4ODU2NX0.FizC7Ia92dqvbtfuU5T3hymh-UX6OEqQRvQnB0oY96Y';
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase client created.");

    supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log("Authentication event fired:", event);
        document.body.innerHTML = `<h1>ทดสอบสำเร็จ! Event: ${event}</h1>`;
    });
    console.log("Auth listener attached.");

} catch (error) {
    console.error("CRITICAL ERROR:", error);
    alert("เกิดข้อผิดพลาดร้ายแรง: " + error.message);
}