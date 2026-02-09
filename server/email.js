/**
 * OpLogica Email Service using Resend
 * Complete email system with verification and welcome emails
 */

require('dotenv').config({ path: __dirname + '/.env' });
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = 'OpLogica <noreply@oplogica.com>';
const APP_URL = process.env.APP_URL || 'https://oplogica.com';

/**
 * Send verification email to new user
 */
async function sendVerificationEmail(to, name, token) {
    try {
        const verifyUrl = `${APP_URL}/api/auth/verify?token=${token}`;
        
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: to,
            subject: 'تفعيل حسابك في OpLogica | Verify your OpLogica account',
            html: `
<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
</head>
<body style="margin:0;padding:0;background:linear-gradient(180deg,#050608 0%,#0a0d12 100%);font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
        <div style="text-align:center;margin-bottom:32px;">
            <div style="display:inline-block;width:72px;height:72px;border:2px solid #00D9FF;border-radius:50%;line-height:72px;box-shadow:0 0 30px rgba(0,217,255,0.25);">
                <span style="color:#00FF88;font-size:28px;">◇</span>
            </div>
            <h1 style="color:#00D9FF;margin:16px 0 0;font-size:26px;letter-spacing:1px;">OpLogica</h1>
            <p style="color:#5a6a7a;font-size:13px;margin:4px 0 0;">AI Decision Intelligence</p>
        </div>
        
        <div style="background:linear-gradient(145deg,#0f1318 0%,#141a22 100%);border-radius:20px;padding:40px 36px;border:1px solid #1e2a3a;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
            <div style="text-align:center;margin-bottom:28px;">
                <span style="display:inline-block;background:linear-gradient(135deg,rgba(0,217,255,0.15),rgba(0,255,136,0.15));color:#00FF88;font-size:12px;font-weight:600;padding:6px 14px;border-radius:20px;border:1px solid rgba(0,255,136,0.3);">خطوة واحدة متبقية</span>
            </div>
            <h2 style="color:#f0f4f8;margin:0 0 12px;font-size:22px;font-weight:700;">
                مرحباً${name ? ' ' + name : ''} 👋
            </h2>
            <p style="color:#8899a8;font-size:16px;line-height:1.7;margin:0 0 8px;">
                شكراً لتسجيلك في OpLogica. فعّل بريدك الإلكتروني بالضغط على الزر أدناه لتفعيل اشتراكك والحصول على <strong style="color:#00FF88;">50 رسالة يومياً</strong> مجاناً.
            </p>
            <p style="color:#6a7a8a;font-size:14px;line-height:1.6;margin:0 0 28px;">
                Thanks for signing up. Click the button below to verify your email and activate your free account (50 messages/day).
            </p>
            
            <div style="text-align:center;margin:32px 0;">
                <a href="${verifyUrl}" 
                   style="display:inline-block;background:linear-gradient(135deg,#00D9FF,#00FF88);color:#050608!important;text-decoration:none;padding:18px 48px;border-radius:12px;font-weight:700;font-size:17px;box-shadow:0 4px 20px rgba(0,217,255,0.35);">
                    ✓ تفعيل الحساب / Verify Account
                </a>
            </div>
            
            <p style="color:#5a6a7a;font-size:13px;margin:24px 0 0;text-align:center;line-height:1.5;">
                الرابط صالح 24 ساعة. لم تنشئ حساباً؟ تجاهل هذه الرسالة.<br>
                <span style="font-size:12px;">Link valid 24h. Ignore this email if you didn't sign up.</span>
            </p>
            <p style="color:#4a5a6a;font-size:11px;margin:16px 0 0;word-break:break-all;">${verifyUrl}</p>
        </div>
        
        <p style="text-align:center;margin-top:28px;color:#4a5a6a;font-size:12px;">© 2026 Oplogica, Inc.</p>
    </div>
</body>
</html>
            `
        });
        
        if (error) {
            console.error('Verification email error:', error);
            return { success: false, error };
        }
        
        console.log('Verification email sent to:', to);
        return { success: true, data };
    } catch (err) {
        console.error('Verification email failed:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Send welcome email after verification
 */
async function sendWelcomeEmail(to, name) {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: to,
            subject: 'Welcome to OpLogica! 🚀',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#050608;font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
        <!-- Logo -->
        <div style="text-align:center;margin-bottom:40px;">
            <div style="display:inline-block;width:60px;height:60px;border:2px solid #00D9FF;border-radius:50%;line-height:60px;">
                <span style="color:#00FF88;font-size:24px;">◇</span>
            </div>
            <h1 style="color:#00D9FF;margin:20px 0 0;font-size:28px;">OpLogica</h1>
        </div>
        
        <!-- Content Box -->
        <div style="background:#0f1318;border-radius:16px;padding:40px;border:1px solid #1e2a3a;">
            <h2 style="color:#f0f4f8;margin:0 0 20px;font-size:24px;">
                تم تفعيل حسابك! You're all set${name ? ', ' + name : ''}! 🎉
            </h2>
            
            <p style="color:#8899a8;font-size:16px;line-height:1.6;margin:0 0 20px;">
                اشتراكك مفعّل الآن. يمكنك تسجيل الدخول واستخدام <strong style="color:#00FF88;">50 رسالة يومياً</strong> مجاناً.
            </p>
            <p style="color:#8899a8;font-size:15px;line-height:1.6;margin:0 0 20px;">
                Your account is active. Sign in and enjoy 50 free messages per day.
            </p>
            
            <div style="text-align:center;margin:30px 0;">
                <a href="${APP_URL}/login" 
                   style="display:inline-block;background:linear-gradient(135deg,#00D9FF,#00FF88);color:#050608;text-decoration:none;padding:16px 40px;border-radius:12px;font-weight:bold;font-size:16px;">
                    تسجيل الدخول / Sign In
                </a>
            </div>
        </div>
        
        <!-- Footer -->
        <div style="text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #1e2a3a;">
            <p style="color:#5a6a7a;font-size:12px;margin:0;">
                © 2026 Oplogica, Inc. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
            `
        });
        
        if (error) {
            console.error('Welcome email error:', error);
            return { success: false, error };
        }
        
        console.log('Welcome email sent to:', to);
        return { success: true, data };
    } catch (err) {
        console.error('Welcome email failed:', err);
        return { success: false, error: err.message };
    }
}

module.exports = {
    sendVerificationEmail,
    sendWelcomeEmail
};
