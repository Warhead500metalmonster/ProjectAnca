const AUTH_ERRORS: Record<string, string> = {
  "Invalid login credentials": "E-posta ya da şifre yanlış.",
  "Email not confirmed": "E-postanı henüz onaylamadın. Gelen kutuna bak.",
  "User already registered": "Bu e-posta zaten kayıtlı. Giriş yapmayı dene.",
  "Password should be at least 6 characters.": "Şifre en az 6 karakter olmalı.",
  // Yasaklı ad ya da e-posta: veritabanı kaydı reddeder (supabase/migrations/008)
  "Database error saving new user": "Bu kullanıcı adı ya da e-posta ile kayıt olunamıyor.",
};
export function authError(message: string) {
  if (AUTH_ERRORS[message]) return AUTH_ERRORS[message];
  if (/rate limit|only request this after/i.test(message)) return "Çok sık denedin. Birkaç dakika bekleyip tekrar dener misin?";
  if (/different from the old password/i.test(message)) return "Yeni şifren eskisinden farklı olmalı.";
  if (/session missing|expired|invalid.*token/i.test(message)) return "Bu linkin süresi dolmuş. Giriş sayfasından yenisini alabilirsin.";
  if (/failed to fetch|network/i.test(message)) return "İnternet bağlantısı kopmuş gibi görünüyor. Bağlantını kontrol edip tekrar dener misin?";
  if (/weak|at least/i.test(message)) return "Şifre biraz zayıf. En az 6 karakter, tahmin edilmesi zor bir şey dene.";
  return message;
}
