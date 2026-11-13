import sys
import logging
from typing import Optional
from dataclasses import dataclass
from app.core.config import settings

logger = logging.getLogger("traceguard.email")

try:
    import resend
    RESEND_AVAILABLE = True
except ImportError:
    resend = None
    RESEND_AVAILABLE = False


@dataclass
class EmailDispatchResult:
    delivered: bool
    message: str
    message_id: Optional[str] = None
    fallback_url: Optional[str] = None

    def __bool__(self) -> bool:
        return self.delivered


def get_email_provider() -> str:
    """
    Returns normalized email provider name.
    """
    return str(settings.EMAIL_PROVIDER or "").strip().strip('"\'').lower()


def is_development_mode() -> bool:
    """
    Checks if email dispatch should use local development console logging.
    Defaults to True unless a production provider (e.g. Resend) is configured with an API key.
    """
    provider = get_email_provider()
    if provider in ["development", "dev", "local", "console", "test"] or not provider:
        return True
    if provider == "resend" and not settings.RESEND_API_KEY:
        return True
    return False


def _print_banner(banner_text: str) -> None:
    """
    Outputs banner cleanly to terminal with immediate flushing.
    """
    try:
        print("\n" + banner_text + "\n", flush=True)
    except Exception:
        pass


def _build_verification_html(verification_url: str, full_name: str = "") -> str:
    """
    Generates a premium cybersecurity branded responsive HTML email for TRACE GUARD.
    Brand colors: Electric Blue #078BFF, Cyan #00CFFF, Dark #0B0D0F, Card #151719, Border #292D32.
    """
    greeting = f"Hello, {full_name}," if full_name else "Hello,"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your TRACE GUARD Account</title>
</head>
<body style="margin:0;padding:0;background-color:#0B0D0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;color:#FFFFFF;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0B0D0F;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background-color:#151719;border:1px solid #292D32;border-radius:16px;padding:40px 32px;box-shadow:0 12px 32px rgba(0,0,0,0.5);">
          <!-- Brand Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;border-bottom:1px solid #292D32;">
              <div style="display:inline-block;padding:8px 16px;border-radius:8px;background-color:#101214;border:1px solid #078BFF40;margin-bottom:12px;">
                <span style="font-size:18px;font-weight:900;letter-spacing:1px;color:#FFFFFF;">TRACE</span>
                <span style="font-size:18px;font-weight:900;letter-spacing:1px;color:#078BFF;">GUARD</span>
              </div>
              <p style="margin:0;font-size:11px;letter-spacing:1.5px;color:#00CFFF;text-transform:uppercase;font-weight:700;">YOUR DIGITAL LIFE. YOUR CONTROL.</p>
            </td>
          </tr>

          <!-- Heading -->
          <tr>
            <td style="padding-top:28px;padding-bottom:16px;">
              <h1 style="margin:0;font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;">Confirm Your Security Vault Identity</h1>
            </td>
          </tr>

          <!-- Message Body -->
          <tr>
            <td style="font-size:14px;line-height:22px;color:#9CA3AF;padding-bottom:28px;">
              <p style="margin:0 0 16px 0;">{greeting}</p>
              <p style="margin:0 0 16px 0;">Thank you for registering with <strong style="color:#FFFFFF;">TRACE GUARD</strong>. To activate your personal data footprint auditor, protect against digital exposure, and unlock your security dashboard, please verify your email address.</p>
              <p style="margin:0;font-size:13px;color:#9CA3AF;">This link is single-use and will expire in <strong style="color:#00CFFF;">{settings.VERIFICATION_TOKEN_EXPIRE_MINUTES} minutes</strong>.</p>
            </td>
          </tr>

          <!-- Action Button -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <a href="{verification_url}" target="_blank" style="display:inline-block;background-color:#078BFF;color:#FFFFFF;font-weight:700;font-size:14px;line-height:14px;padding:16px 36px;border-radius:12px;text-decoration:none;box-shadow:0 0 24px rgba(7,139,255,0.4);">
                Verify Account &amp; Unlock Vault
              </a>
            </td>
          </tr>

          <!-- Fallback URL -->
          <tr>
            <td style="background-color:#101214;border:1px solid #292D32;border-radius:10px;padding:16px;font-size:12px;color:#9CA3AF;line-height:18px;">
              <p style="margin:0 0 8px 0;font-weight:600;color:#FFFFFF;">Button not working? Copy and paste this URL into your browser:</p>
              <p style="margin:0;word-break:break-all;font-family:Courier,monospace;color:#00CFFF;font-size:11px;">{verification_url}</p>
            </td>
          </tr>

          <!-- Security Footer Notice -->
          <tr>
            <td style="padding-top:28px;font-size:11px;color:#6B7280;line-height:16px;text-align:center;">
              <p style="margin:0 0 6px 0;">If you did not create a TRACE GUARD account, you can safely ignore this email.</p>
              <p style="margin:0;">&copy; TRACE GUARD &bull; AI-Powered Personal Data Footprint Auditor</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def _build_password_reset_html(reset_url: str, full_name: str = "") -> str:
    """
    Generates a password recovery branded responsive HTML email for TRACE GUARD.
    """
    greeting = f"Hello, {full_name}," if full_name else "Hello,"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your TRACE GUARD Password</title>
</head>
<body style="margin:0;padding:0;background-color:#0B0D0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;color:#FFFFFF;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0B0D0F;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background-color:#151719;border:1px solid #292D32;border-radius:16px;padding:40px 32px;box-shadow:0 12px 32px rgba(0,0,0,0.5);">
          <tr>
            <td align="center" style="padding-bottom:24px;border-bottom:1px solid #292D32;">
              <div style="display:inline-block;padding:8px 16px;border-radius:8px;background-color:#101214;border:1px solid #078BFF40;margin-bottom:12px;">
                <span style="font-size:18px;font-weight:900;letter-spacing:1px;color:#FFFFFF;">TRACE</span>
                <span style="font-size:18px;font-weight:900;letter-spacing:1px;color:#078BFF;">GUARD</span>
              </div>
              <p style="margin:0;font-size:11px;letter-spacing:1.5px;color:#00CFFF;text-transform:uppercase;font-weight:700;">YOUR DIGITAL LIFE. YOUR CONTROL.</p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:28px;padding-bottom:16px;">
              <h1 style="margin:0;font-size:22px;font-weight:800;color:#FFFFFF;">Password Reset Request</h1>
            </td>
          </tr>
          <tr>
            <td style="font-size:14px;line-height:22px;color:#9CA3AF;padding-bottom:28px;">
              <p style="margin:0 0 16px 0;">{greeting}</p>
              <p style="margin:0 0 16px 0;">A password reset request was initiated for your TRACE GUARD security vault. Click the button below to establish a new password.</p>
              <p style="margin:0;font-size:13px;color:#9CA3AF;">This recovery link expires in <strong style="color:#00CFFF;">{settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes</strong> and is single-use.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <a href="{reset_url}" target="_blank" style="display:inline-block;background-color:#078BFF;color:#FFFFFF;font-weight:700;font-size:14px;line-height:14px;padding:16px 36px;border-radius:12px;text-decoration:none;">
                Reset Security Password
              </a>
            </td>
          </tr>
          <tr>
            <td style="background-color:#101214;border:1px solid #292D32;border-radius:10px;padding:16px;font-size:12px;color:#9CA3AF;line-height:18px;">
              <p style="margin:0 0 8px 0;font-weight:600;color:#FFFFFF;">Direct recovery URL:</p>
              <p style="margin:0;word-break:break-all;font-family:Courier,monospace;color:#00CFFF;font-size:11px;">{reset_url}</p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:28px;font-size:11px;color:#6B7280;line-height:16px;text-align:center;">
              <p style="margin:0 0 6px 0;">If you did not request a password reset, you can safely disregard this message.</p>
              <p style="margin:0;">&copy; TRACE GUARD &bull; Automated Security Recovery</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def _send_via_resend(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str
) -> Optional[str]:
    """
    Sends an email via the official Resend Python SDK.
    Never exposes API keys or raw verification tokens in logs.
    """
    if not RESEND_AVAILABLE:
        raise RuntimeError("The 'resend' Python package is not installed.")

    if not settings.RESEND_API_KEY:
        raise ValueError("RESEND_API_KEY is not configured in environment.")

    # Configure API key on the SDK
    resend.api_key = settings.RESEND_API_KEY

    params: resend.Emails.SendParams = {
        "from": settings.EMAIL_FROM,
        "to": [to_email],
        "subject": subject,
        "html": html_content,
        "text": text_content,
    }

    try:
        response = resend.Emails.send(params)
        email_id = None
        if isinstance(response, dict):
            email_id = response.get("id")
        elif hasattr(response, "id"):
            email_id = getattr(response, "id")

        logger.info("Email dispatched successfully via Resend to %s (Message ID: %s)", to_email, email_id)
        return str(email_id) if email_id else "unknown_id"
    except Exception as err:
        err_str = str(err)
        # Check specifically for Resend sandbox domain restriction
        if "can only send testing emails to your own email address" in err_str:
            hint = (
                f"Resend Sandbox Restriction: Resend's test sender '{settings.EMAIL_FROM}' "
                f"can only deliver emails to the email address registered on your Resend account. "
                f"To deliver to '{to_email}', verify a custom domain in your Resend dashboard."
            )
            logger.error("Resend API delivery error: %s. %s", err_str, hint)
            raise RuntimeError(f"{err_str} -> {hint}") from err

        logger.error("Resend API delivery error to %s: %s", to_email, err_str)
        raise


def send_verification_email(
    email: str,
    token: str,
    full_name: str = "",
    action: str = "Registration"
) -> EmailDispatchResult:
    """
    Dispatches account verification link.
    If EMAIL_PROVIDER=resend and RESEND_API_KEY is configured, sends via Resend.
    If EMAIL_PROVIDER=development or on fallback, prints to terminal.
    Returns EmailDispatchResult with delivery status and diagnostic notices.
    """
    frontend_url = settings.FRONTEND_URL.rstrip("/")
    verification_url = f"{frontend_url}/verify-email?token={token}"
    action_label = "Registration" if action == "Registration" else "Verification Resend"

    provider = get_email_provider()

    # 1. Resend Provider
    if provider == "resend" and settings.RESEND_API_KEY:
        subject = "Verify Your TRACE GUARD Account" if action == "Registration" else "TRACE GUARD: New Verification Link"
        html_content = _build_verification_html(verification_url, full_name)
        text_content = (
            f"TRACE GUARD: YOUR DIGITAL LIFE. YOUR CONTROL.\n\n"
            f"Hello {full_name or 'Security Operator'},\n\n"
            f"Thank you for registering with TRACE GUARD. To activate your personal data footprint auditor, "
            f"please confirm your email address by opening the following link:\n\n"
            f"{verification_url}\n\n"
            f"This single-use link expires in {settings.VERIFICATION_TOKEN_EXPIRE_MINUTES} minutes.\n\n"
            f"If you did not create a TRACE GUARD account, you can safely ignore this email.\n"
        )

        try:
            email_id = _send_via_resend(email, subject, html_content, text_content)
            # Log clean delivery confirmation
            dispatch_banner = (
                "========== TRACE GUARD RESEND DISPATCH ==========\n"
                f"{action_label}: DISPATCHED VIA RESEND\n"
                f"Recipient: {email}\n"
                f"Sender: {settings.EMAIL_FROM}\n"
                f"Message ID: {email_id}\n"
                "================================================="
            )
            _print_banner(dispatch_banner)
            return EmailDispatchResult(
                delivered=True,
                message=f"Verification email successfully dispatched via Resend to {email}.",
                message_id=email_id,
                fallback_url=verification_url,
            )
        except Exception as err:
            err_str = str(err)
            if "can only send testing emails to your own email address" in err_str:
                notice = (
                    f"Resend Sandbox Restriction: Resend's test sender '{settings.EMAIL_FROM}' "
                    f"can only deliver emails to your registered Resend account (mukundbhoyar70@gmail.com). "
                    f"To deliver to other addresses, verify your custom domain in the Resend dashboard."
                )
            else:
                notice = f"Resend delivery error: {err_str}"

            err_banner = (
                "========== TRACE GUARD RESEND DELIVERY NOTICE ==========\n"
                f"{action_label}: RESEND API DELIVERY ATTEMPT\n"
                f"Recipient: {email}\n"
                f"Notice: {notice}\n"
                f"DEV FALLBACK VERIFICATION LINK:\n"
                f"{verification_url}\n"
                "========================================================"
            )
            _print_banner(err_banner)
            return EmailDispatchResult(
                delivered=False,
                message=notice,
                fallback_url=verification_url,
            )

    # 2. Development Console Provider
    if is_development_mode():
        banner = (
            "========== TRACE GUARD VERIFICATION ==========\n"
            f"{action_label}: SUCCESS\n"
            f"Recipient: {email}\n"
            "COPY VERIFICATION LINK:\n"
            f"{verification_url}\n"
            f"Expires: {settings.VERIFICATION_TOKEN_EXPIRE_MINUTES} minutes\n"
            "==============================================="
        )
        _print_banner(banner)
        return EmailDispatchResult(
            delivered=True,
            message=f"Verification link generated for development console for {email}.",
            fallback_url=verification_url,
        )

    # 3. Generic fallback
    logger.info("Sending verification email via %s to %s", provider, email)
    return EmailDispatchResult(
        delivered=False,
        message=f"Email provider '{provider}' is not fully configured.",
        fallback_url=verification_url,
    )


def send_password_reset_email(email: str, token: str, full_name: str = "") -> bool:
    """
    Dispatches password recovery link.
    """
    frontend_url = settings.FRONTEND_URL.rstrip("/")
    reset_url = f"{frontend_url}/reset-password?token={token}"

    provider = get_email_provider()

    if provider == "resend" and settings.RESEND_API_KEY:
        subject = "Reset Your TRACE GUARD Password"
        html_content = _build_password_reset_html(reset_url, full_name)
        text_content = (
            f"TRACE GUARD: YOUR DIGITAL LIFE. YOUR CONTROL.\n\n"
            f"Hello {full_name or 'Security Operator'},\n\n"
            f"A password reset request was initiated for your TRACE GUARD account. "
            f"Open the following link to establish a new password:\n\n"
            f"{reset_url}\n\n"
            f"This link expires in {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes.\n\n"
            f"If you did not request this, you can safely ignore this message.\n"
        )

        try:
            email_id = _send_via_resend(email, subject, html_content, text_content)
            reset_banner = (
                "========== TRACE GUARD RESEND DISPATCH ==========\n"
                f"Password Recovery: DISPATCHED VIA RESEND\n"
                f"Recipient: {email}\n"
                f"Sender: {settings.EMAIL_FROM}\n"
                f"Message ID: {email_id}\n"
                "================================================="
            )
            _print_banner(reset_banner)
            return True
        except Exception as err:
            err_banner = (
                "========== TRACE GUARD RESEND DELIVERY NOTICE ==========\n"
                "Password Recovery: RESEND API DELIVERY ATTEMPT\n"
                f"Recipient: {email}\n"
                f"Notice: {str(err)}\n"
                f"DEV FALLBACK RESET LINK:\n"
                f"{reset_url}\n"
                "========================================================"
            )
            _print_banner(err_banner)
            return True

    if is_development_mode():
        banner = (
            "========== TRACE GUARD PASSWORD RECOVERY ==========\n"
            "Status: SUCCESS\n"
            f"Recipient: {email}\n"
            "COPY PASSWORD RESET LINK:\n"
            f"{reset_url}\n"
            f"Expires: {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes\n"
            "==================================================="
        )
        _print_banner(banner)
        return True

    logger.info("Sending password reset email via %s to %s", provider, email)
    return True
