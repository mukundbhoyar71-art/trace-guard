import io
import os
import re
import zlib
import datetime
import uuid
from typing import Optional, List, Dict, Any, Tuple

from app.schemas.media import (
    SensitiveFindingItem,
    DocumentScanResponse,
)

def utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)

# ==========================================
# VALIDATION ALGORITHMS
# ==========================================

def validate_luhn(number_str: str) -> bool:
    """Validates credit card PAN using standard Luhn (mod 10) algorithm."""
    digits = [int(c) for c in number_str if c.isdigit()]
    if len(digits) < 13 or len(digits) > 19:
        return False
    checksum = 0
    for i, d in enumerate(reversed(digits)):
        if i % 2 == 1:
            d = d * 2
            if d > 9:
                d -= 9
        checksum += d
    return checksum % 10 == 0

def identify_card_network(digits_only: str) -> str:
    """Identifies the credit card network brand based on IIN/BIN."""
    if digits_only.startswith("4"):
        return "Visa"
    elif (
        digits_only.startswith(("51", "52", "53", "54", "55"))
        or (2221 <= int(digits_only[:4]) <= 2720 if len(digits_only) >= 4 else False)
    ):
        return "MasterCard"
    elif digits_only.startswith(("34", "37")):
        return "American Express"
    elif digits_only.startswith("6011") or digits_only.startswith("65"):
        return "Discover"
    return "Payment Card"

def validate_iban(iban_str: str) -> bool:
    """Validates International Bank Account Number (IBAN) using standard Mod-97."""
    clean = iban_str.replace(" ", "").upper()
    if len(clean) < 15 or len(clean) > 34:
        return False
    # First 2 must be country code alpha, next 2 must be check digits
    if not clean[:2].isalpha() or not clean[2:4].isdigit():
        return False

    rearranged = clean[4:] + clean[:4]
    numeric_str = ""
    for char in rearranged:
        if char.isdigit():
            numeric_str += char
        elif char.isalpha():
            numeric_str += str(ord(char) - ord("A") + 10)
        else:
            return False
    try:
        return int(numeric_str) % 97 == 1
    except Exception:
        return False

# ==========================================
# MASKING UTILITIES
# ==========================================

def mask_card(card_str: str) -> str:
    digits = [c for c in card_str if c.isdigit()]
    last4 = "".join(digits[-4:])
    brand = identify_card_network("".join(digits))
    return f"{brand} (****-****-****-{last4})"

def mask_email(email: str) -> str:
    try:
        parts = email.split("@")
        name, domain = parts[0], parts[1]
        visible = name[:2] if len(name) >= 2 else name[:1]
        return f"{visible}****@{domain}"
    except Exception:
        return "****@****.***"

def mask_phone(phone: str) -> str:
    digits = [c for c in phone if c.isdigit()]
    last4 = "".join(digits[-4:]) if len(digits) >= 4 else "0000"
    return f"***-***-{last4}"

def mask_ssn(ssn: str) -> str:
    digits = [c for c in ssn if c.isdigit()]
    last4 = "".join(digits[-4:]) if len(digits) >= 4 else "0000"
    return f"***-**-{last4}"

def mask_iban(iban_clean: str) -> str:
    if len(iban_clean) > 8:
        return f"{iban_clean[:4]}****{iban_clean[-4:]}"
    return "****"

def mask_secret(secret_str: str) -> str:
    prefix = secret_str[:4] if len(secret_str) >= 4 else ""
    return f"{prefix}****************"

# ==========================================
# TEXT EXTRACTION (PLAIN & PDF)
# ==========================================

def extract_text_from_pdf(pdf_bytes: bytes) -> List[str]:
    """Extracts text streams from PDF bytes without external binary dependencies."""
    extracted_lines: List[str] = []
    try:
        # Match compressed stream blocks
        stream_matches = re.finditer(rb"stream[\r\n]+(.*?)([\r\n]+endstream)", pdf_bytes, re.DOTALL)
        for match in stream_matches:
            raw_stream = match.group(1)
            decompressed = None
            try:
                decompressed = zlib.decompress(raw_stream)
            except Exception:
                decompressed = raw_stream

            # Extract Tj and TJ strings
            tj_matches = re.findall(rb"\(([^)]*)\)\s*Tj", decompressed)
            for chunk in tj_matches:
                text = chunk.decode("utf-8", errors="ignore").strip()
                if text:
                    extracted_lines.append(text)

            tj_arrays = re.findall(rb"\[(.*?)\]\s*TJ", decompressed)
            for arr in tj_arrays:
                items = re.findall(rb"\(([^)]*)\)", arr)
                line = "".join([i.decode("utf-8", errors="ignore") for i in items]).strip()
                if line:
                    extracted_lines.append(line)

        # Fallback if stream was empty: scan raw text chunks in PDF object dictionary
        if not extracted_lines:
            raw_literals = re.findall(rb"\(([^)]{4,})\)", pdf_bytes)
            for lit in raw_literals[:200]:
                text = lit.decode("utf-8", errors="ignore").strip()
                if any(c.isalnum() for c in text):
                    extracted_lines.append(text)

    except Exception:
        pass

    return extracted_lines if extracted_lines else ["(No extractable text layers found in PDF)"]

def load_file_lines(file_bytes: bytes, filename: str) -> Tuple[List[str], bool]:
    """Decodes file bytes into lines based on format."""
    ext = filename.split(".")[-1].lower() if "." in filename else ""

    if ext == "pdf":
        lines = extract_text_from_pdf(file_bytes)
        return lines, True

    supported_text_exts = [
        "txt", "csv", "json", "log", "md", "xml", "yaml", "yml", "html", "env", "sql", "conf", "ini"
    ]
    if ext in supported_text_exts:
        try:
            content = file_bytes.decode("utf-8", errors="replace")
        except Exception:
            content = file_bytes.decode("latin-1", errors="replace")
        return content.splitlines(), True

    return [], False

# ==========================================
# SENSITIVE PATTERN SCANNER
# ==========================================

# Regex Patterns
RE_EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
RE_PHONE = re.compile(r"(?:\+?[1-9]\d{0,2}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b")
RE_SSN = re.compile(r"\b(?!000|666|9\d{2})(\d{3})[- ]?(?!00)(\d{2})[- ]?(?!0000)(\d{4})\b")
RE_IBAN = re.compile(r"\b[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}\b")
RE_CREDIT_CARD = re.compile(r"\b(?:\d{4}[- ]?){3}\d{4}\b|\b\d{13,19}\b")

# API Keys & Secrets
RE_PEM_KEY = re.compile(r"-----BEGIN (?:[A-Z ]+)?PRIVATE KEY-----")
RE_AWS_KEY = re.compile(r"\bAKIA[0-9A-Z]{16}\b")
RE_GITHUB_PAT = re.compile(r"\bgh[pousr]_[0-9a-zA-Z]{36,255}\b")
RE_GOOGLE_API = re.compile(r"\bAIza[0-9A-Za-z\-_]{35}\b")
RE_SLACK_TOKEN = re.compile(r"\bxox[baprs]-[0-9a-zA-Z]{10,48}\b")
RE_GENERIC_SECRET = re.compile(
    r"(?i)\b(?:api[_-]?key|secret[_-]?key|auth[_-]?token|bearer[_-]?token|private[_-]?key)\s*[:=]\s*['\"]?([A-Za-z0-9_\-\.]{20,})['\"]?"
)

# Address patterns
RE_US_ADDRESS = re.compile(
    r"\b\d{1,5}\s+(?:[A-Za-z0-9.-]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir)\b",
    re.IGNORECASE,
)
RE_ZIP_CODE = re.compile(
    r"\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s+\d{5}(?:-\d{4})?\b"
)

def scan_document_for_pii(file_bytes: bytes, filename: str) -> DocumentScanResponse:
    """
    Scans TXT, CSV, JSON, LOG, and PDF documents for PII and secrets with zero hallucination.
    Employs Luhn checksum validation for credit cards and Mod-97 for IBANs.
    """
    lines, is_supported = load_file_lines(file_bytes, filename)
    ext = filename.split(".")[-1].lower() if "." in filename else ""

    if not is_supported:
        return DocumentScanResponse(
            file_name=filename,
            file_type=f"application/{ext}",
            file_size_bytes=len(file_bytes),
            total_lines=0,
            is_supported=False,
            scan_status="UNSUPPORTED_FORMAT",
            findings=[],
            findings_count_by_severity={"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0},
            overall_privacy_risk="CLEAN",
            scanned_at=utc_now(),
            recommendations=[f"Format .{ext} is not supported. Upload TXT, CSV, JSON, LOG, MD, or PDF documents."],
        )

    findings: List[SensitiveFindingItem] = []
    severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}

    # Track unique finding keys to avoid spamming duplicates on adjacent lines
    seen_findings = set()

    for line_idx, line in enumerate(lines):
        line_num = line_idx + 1

        # 1. PEM Private Keys
        if RE_PEM_KEY.search(line):
            key = ("PEM", line_num)
            if key not in seen_findings:
                seen_findings.add(key)
                severity_counts["CRITICAL"] += 1
                findings.append(
                    SensitiveFindingItem(
                        finding_id=f"find_{uuid.uuid4().hex[:8]}",
                        category="API / Secret Key",
                        detection_type="CONFIRMED",
                        severity="CRITICAL",
                        masked_value="-----BEGIN PRIVATE KEY----- [MASKED]",
                        line_number=line_num,
                        column_offset=line.find("-----BEGIN"),
                        evidence_snippet="-----BEGIN [MASKED] PRIVATE KEY-----",
                        risk_explanation="CRITICAL EXPOSURE: Cryptographic private key header detected. Compromise enables full decryption of encrypted sessions or spoofing server identities.",
                        remediation_advice="Immediately revoke this cryptographic key pair and re-issue credentials into a secure secret manager (e.g., Vault, AWS Secrets Manager).",
                    )
                )

        # 2. Cloud & SaaS API Keys
        for match in RE_AWS_KEY.finditer(line):
            val = match.group(0)
            key = ("AWS_KEY", val)
            if key not in seen_findings:
                seen_findings.add(key)
                severity_counts["CRITICAL"] += 1
                findings.append(
                    SensitiveFindingItem(
                        finding_id=f"find_{uuid.uuid4().hex[:8]}",
                        category="API / Secret Key",
                        detection_type="CONFIRMED",
                        severity="CRITICAL",
                        masked_value=mask_secret(val),
                        line_number=line_num,
                        column_offset=match.start(),
                        evidence_snippet=line[max(0, match.start()-15):min(len(line), match.end()+15)].replace(val, mask_secret(val)),
                        risk_explanation="AWS Access Key ID exposed. Grants programmatic control over cloud infrastructure, S3 storage buckets, and IAM roles.",
                        remediation_advice="Revoke this IAM access key immediately in AWS IAM Console and purge from code repository history.",
                    )
                )

        for match in RE_GITHUB_PAT.finditer(line):
            val = match.group(0)
            key = ("GITHUB_PAT", val)
            if key not in seen_findings:
                seen_findings.add(key)
                severity_counts["CRITICAL"] += 1
                findings.append(
                    SensitiveFindingItem(
                        finding_id=f"find_{uuid.uuid4().hex[:8]}",
                        category="API / Secret Key",
                        detection_type="CONFIRMED",
                        severity="CRITICAL",
                        masked_value=mask_secret(val),
                        line_number=line_num,
                        column_offset=match.start(),
                        evidence_snippet=line[max(0, match.start()-15):min(len(line), match.end()+15)].replace(val, mask_secret(val)),
                        risk_explanation="GitHub Personal Access Token detected. Enables unauthorized Git repository cloning, tampering, and CI/CD secret extraction.",
                        remediation_advice="Revoke token immediately in GitHub Settings > Developer Settings > Personal Access Tokens.",
                    )
                )

        for match in RE_GOOGLE_API.finditer(line):
            val = match.group(0)
            key = ("GOOGLE_API", val)
            if key not in seen_findings:
                seen_findings.add(key)
                severity_counts["CRITICAL"] += 1
                findings.append(
                    SensitiveFindingItem(
                        finding_id=f"find_{uuid.uuid4().hex[:8]}",
                        category="API / Secret Key",
                        detection_type="CONFIRMED",
                        severity="CRITICAL",
                        masked_value=mask_secret(val),
                        line_number=line_num,
                        column_offset=match.start(),
                        evidence_snippet=line[max(0, match.start()-15):min(len(line), match.end()+15)].replace(val, mask_secret(val)),
                        risk_explanation="Google Cloud Platform API Key detected. Can incur billable API consumption and compromise Google Cloud services.",
                        remediation_advice="Apply API key restrictions (HTTP referrer or IP restriction) in GCP Console or regenerate the key.",
                    )
                )

        for match in RE_SLACK_TOKEN.finditer(line):
            val = match.group(0)
            key = ("SLACK_TOKEN", val)
            if key not in seen_findings:
                seen_findings.add(key)
                severity_counts["CRITICAL"] += 1
                findings.append(
                    SensitiveFindingItem(
                        finding_id=f"find_{uuid.uuid4().hex[:8]}",
                        category="API / Secret Key",
                        detection_type="CONFIRMED",
                        severity="CRITICAL",
                        masked_value=mask_secret(val),
                        line_number=line_num,
                        column_offset=match.start(),
                        evidence_snippet=line[max(0, match.start()-15):min(len(line), match.end()+15)].replace(val, mask_secret(val)),
                        risk_explanation="Slack OAuth / Bot token detected. Grants read/write access to internal workplace communication channels.",
                        remediation_advice="Revoke token via Slack App Management directory.",
                    )
                )

        # 3. Generic Secret Variables
        for match in RE_GENERIC_SECRET.finditer(line):
            val = match.group(1)
            # Filter out obvious false positives (e.g. "undefined", "true", "YOUR_API_KEY")
            if any(fp in val.lower() for fp in ["placeholder", "example", "changeme", "your_api"]):
                continue
            key = ("GENERIC_SECRET", val)
            if key not in seen_findings:
                seen_findings.add(key)
                severity_counts["HIGH"] += 1
                findings.append(
                    SensitiveFindingItem(
                        finding_id=f"find_{uuid.uuid4().hex[:8]}",
                        category="API / Secret Key",
                        detection_type="POSSIBLE",
                        severity="HIGH",
                        masked_value=mask_secret(val),
                        line_number=line_num,
                        column_offset=match.start(1),
                        evidence_snippet=line[max(0, match.start()-15):min(len(line), match.end()+15)].replace(val, mask_secret(val)),
                        risk_explanation="Hardcoded API or authentication credential detected in assignment statement.",
                        remediation_advice="Migrate secret into environment variables or secrets store.",
                    )
                )

        # 4. Credit Card Numbers (Strict Luhn Validation)
        for match in RE_CREDIT_CARD.finditer(line):
            raw_card = match.group(0)
            digits = "".join([c for c in raw_card if c.isdigit()])
            if 13 <= len(digits) <= 19 and validate_luhn(digits):
                key = ("CC", digits)
                if key not in seen_findings:
                    seen_findings.add(key)
                    severity_counts["CRITICAL"] += 1
                    brand = identify_card_network(digits)
                    findings.append(
                        SensitiveFindingItem(
                            finding_id=f"find_{uuid.uuid4().hex[:8]}",
                            category="Credit Card Number",
                            detection_type="CONFIRMED",
                            severity="CRITICAL",
                            masked_value=mask_card(raw_card),
                            line_number=line_num,
                            column_offset=match.start(),
                            evidence_snippet=line[max(0, match.start()-15):min(len(line), match.end()+15)].replace(raw_card, mask_card(raw_card)),
                            risk_explanation=f"CRITICAL FINANCIAL EXPOSURE: Mathematically verified {brand} Primary Account Number (PAN) passing Luhn checksum.",
                            remediation_advice="PCI-DSS Violation: Immediately redact payment card number from unencrypted storage or log files.",
                        )
                    )

        # 5. US Social Security Numbers (SSN)
        for match in RE_SSN.finditer(line):
            raw_ssn = match.group(0)
            digits = "".join([c for c in raw_ssn if c.isdigit()])
            if len(digits) == 9:
                key = ("SSN", digits)
                if key not in seen_findings:
                    seen_findings.add(key)
                    severity_counts["CRITICAL"] += 1
                    findings.append(
                        SensitiveFindingItem(
                            finding_id=f"find_{uuid.uuid4().hex[:8]}",
                            category="Social Security Number (SSN)",
                            detection_type="CONFIRMED",
                            severity="CRITICAL",
                            masked_value=mask_ssn(raw_ssn),
                            line_number=line_num,
                            column_offset=match.start(),
                            evidence_snippet=line[max(0, match.start()-15):min(len(line), match.end()+15)].replace(raw_ssn, mask_ssn(raw_ssn)),
                            risk_explanation="CRITICAL IDENTITY THEFT RISK: 9-digit US Social Security Number format detected with valid area/group distribution.",
                            remediation_advice="Redact SSNs from files immediately. Never store plaintext national identification numbers in flat files.",
                        )
                    )

        # 6. IBAN Bank Accounts (Strict Mod-97 Checksum)
        for match in RE_IBAN.finditer(line):
            raw_iban = match.group(0)
            if validate_iban(raw_iban):
                key = ("IBAN", raw_iban)
                if key not in seen_findings:
                    seen_findings.add(key)
                    severity_counts["CRITICAL"] += 1
                    findings.append(
                        SensitiveFindingItem(
                            finding_id=f"find_{uuid.uuid4().hex[:8]}",
                            category="IBAN Bank Account",
                            detection_type="CONFIRMED",
                            severity="CRITICAL",
                            masked_value=mask_iban(raw_iban),
                            line_number=line_num,
                            column_offset=match.start(),
                            evidence_snippet=line[max(0, match.start()-15):min(len(line), match.end()+15)].replace(raw_iban, mask_iban(raw_iban)),
                            risk_explanation="CRITICAL FINANCIAL RISK: Mathematically validated International Bank Account Number (IBAN) passing Mod-97 checksum.",
                            remediation_advice="Remove bank account identifiers from unencrypted text files.",
                        )
                    )

        # 7. Email Addresses
        for match in RE_EMAIL.finditer(line):
            raw_email = match.group(0)
            # Filter standard system noise or localhost
            if any(domain in raw_email.lower() for domain in ["example.com", "localhost", "schema.org"]):
                continue
            key = ("EMAIL", raw_email.lower())
            if key not in seen_findings:
                seen_findings.add(key)
                severity_counts["MEDIUM"] += 1
                findings.append(
                    SensitiveFindingItem(
                        finding_id=f"find_{uuid.uuid4().hex[:8]}",
                        category="Email Address",
                        detection_type="CONFIRMED",
                        severity="MEDIUM",
                        masked_value=mask_email(raw_email),
                        line_number=line_num,
                        column_offset=match.start(),
                        evidence_snippet=line[max(0, match.start()-15):min(len(line), match.end()+15)].replace(raw_email, mask_email(raw_email)),
                        risk_explanation="Personal Identifiable Information (PII): Direct email address exposes user identity to spam and credential stuffing.",
                        remediation_advice="Sanitize or pseudonymize personal contact addresses in production logs and test documents.",
                    )
                )

        # 8. Phone Numbers
        for match in RE_PHONE.finditer(line):
            raw_phone = match.group(0)
            digits = "".join([c for c in raw_phone if c.isdigit()])
            if 10 <= len(digits) <= 15:
                key = ("PHONE", digits)
                if key not in seen_findings:
                    seen_findings.add(key)
                    severity_counts["MEDIUM"] += 1
                    findings.append(
                        SensitiveFindingItem(
                            finding_id=f"find_{uuid.uuid4().hex[:8]}",
                            category="Phone Number",
                            detection_type="CONFIRMED",
                            severity="MEDIUM",
                            masked_value=mask_phone(raw_phone),
                            line_number=line_num,
                            column_offset=match.start(),
                            evidence_snippet=line[max(0, match.start()-15):min(len(line), match.end()+15)].replace(raw_phone, mask_phone(raw_phone)),
                            risk_explanation="Personal telephone number exposure. Subject to SIM swapping, unsolicited telemarketing, and voice phishing.",
                            remediation_advice="Mask or truncate phone numbers to last 4 digits in non-production environments.",
                        )
                    )

        # 9. Physical Addresses
        for match in RE_US_ADDRESS.finditer(line):
            raw_addr = match.group(0)
            key = ("ADDR", raw_addr.lower())
            if key not in seen_findings:
                seen_findings.add(key)
                severity_counts["HIGH"] += 1
                masked = re.sub(r"^\d+", "****", raw_addr)
                findings.append(
                    SensitiveFindingItem(
                        finding_id=f"find_{uuid.uuid4().hex[:8]}",
                        category="Physical Address",
                        detection_type="POSSIBLE",
                        severity="HIGH",
                        masked_value=masked,
                        line_number=line_num,
                        column_offset=match.start(),
                        evidence_snippet=line[max(0, match.start()-15):min(len(line), match.end()+15)].replace(raw_addr, masked),
                        risk_explanation="Physical residential or business street address pattern detected.",
                        remediation_advice="Redact physical location data to safeguard resident privacy.",
                    )
                )

    # Determine overall privacy risk
    if severity_counts["CRITICAL"] > 0:
        overall_risk = "CRITICAL"
    elif severity_counts["HIGH"] > 0:
        overall_risk = "HIGH"
    elif severity_counts["MEDIUM"] > 0:
        overall_risk = "MEDIUM"
    elif severity_counts["LOW"] > 0:
        overall_risk = "LOW"
    else:
        overall_risk = "CLEAN"

    # Actionable recommendations
    recommendations = []
    if severity_counts["CRITICAL"] > 0:
        recommendations.append("High-severity cryptographic secrets or financial PANs detected. Revoke keys and redact financial data immediately.")
    if severity_counts["HIGH"] > 0:
        recommendations.append("Hardcoded credentials or physical addresses found. Audit codebase or data dumps before external transfer.")
    if severity_counts["MEDIUM"] > 0:
        recommendations.append("Personal contact details (emails, phone numbers) detected. Apply data anonymization policies.")
    if not findings:
        recommendations.append("No common PII, cryptographic keys, or financial cards were detected in this document.")

    return DocumentScanResponse(
        file_name=filename,
        file_type=f"text/{ext}" if ext != "pdf" else "application/pdf",
        file_size_bytes=len(file_bytes),
        total_lines=len(lines),
        is_supported=True,
        scan_status="COMPLETED",
        findings=findings,
        findings_count_by_severity=severity_counts,
        overall_privacy_risk=overall_risk,
        scanned_at=utc_now(),
        recommendations=recommendations,
    )

