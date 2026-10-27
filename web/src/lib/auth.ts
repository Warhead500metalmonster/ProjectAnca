const AUTH_ERRORS: Record<string, string> = {
  "Invalid login credentials": "E-posta ya da şifre yanlış.",
  "Email not confirmed": "E-postanı henüz onaylamadın. Gelen kutuna bak.",
  "User already registered": "Bu e-posta zaten kayıtlı. Giriş yapmayı dene.",
  "Password should be at least 6 characters.": "Şifre en az 6 karakter olmalı.",
};
export const authError = (message: string) => AUTH_ERRORS[message] || message;
