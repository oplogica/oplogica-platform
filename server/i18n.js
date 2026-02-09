/**
 * OpLogica Internationalization Module
 * Provides translations for verified decision output in chat responses.
 *
 * Supported languages: en (English), ar (Arabic), tr (Turkish)
 *
 * RULES:
 * - Cryptographic data is NEVER translated (hashes, signatures, Merkle roots)
 * - Technical identifiers stay in English (PoO, PoR, PoI, SHA-256, HMAC)
 * - Parameter variable names stay in English (vital_score, credit_score, etc.)
 * - All human-readable UI text IS translated
 */

const translations = {

  shared: {
    en: {
      triadicTitle: 'OpLogica Triadic Verification',
      parameter: 'Parameter',
      value: 'Value',
      reasoningChain: 'Reasoning Chain — Complete Rule Evaluation',
      ruleHeader: 'Rule',
      inputHeader: 'Input',
      resultHeader: 'Result',
      triggered: 'TRIGGERED',
      notTriggered: '—',
      reasonGraph: 'Reason Graph',
      pooTitle: 'Proof of Operation (PoO) — click to expand',
      porTitle: 'Proof of Reason (PoR) — hashes & structure',
      poiTitle: 'Proof of Intent (PoI) — constraints',
      hash: 'Hash',
      timestamp: 'Timestamp',
      algorithm: 'Algorithm',
      signature: 'Signature',
      vertices: 'Vertices',
      edges: 'Edges',
      graphHash: 'Graph Hash',
      policy: 'Policy',
      declared: 'Declared',
      status: 'Status',
      constraint: 'Constraint',
      verified: 'VERIFIED',
      temporalPrecedence: 'Temporal Precedence',
      poiDeclared: 'PoI declared',
      decision: 'Decision',
      inferenceRelationships: 'inference relationships',
      premises: 'premises',
      rules: 'rules',
      conclusions: 'conclusions',
      legendPremise: 'Premise (Observed Data)',
      legendRule: 'Rule (From policy)',
      legendConclusion: 'Conclusion (Derived)',
      disclaimer: 'This is a research demonstration of verifiable AI decision-making. Not intended for real-world use.',
      yes: 'Yes',
      no: 'No',
    },
    ar: {
      triadicTitle: 'التحقق الثلاثي — OpLogica',
      parameter: 'المعامل',
      value: 'القيمة',
      reasoningChain: 'سلسلة الاستدلال — تقييم القواعد الكامل',
      ruleHeader: 'القاعدة',
      inputHeader: 'المدخل',
      resultHeader: 'النتيجة',
      triggered: 'مُفعَّل',
      notTriggered: '—',
      reasonGraph: 'رسم بياني للاستدلال',
      pooTitle: 'إثبات العملية (PoO) — انقر للتوسيع',
      porTitle: 'إثبات المنطق (PoR) — التجزئات والبنية',
      poiTitle: 'إثبات القصد (PoI) — القيود',
      hash: 'التجزئة',
      timestamp: 'الطابع الزمني',
      algorithm: 'الخوارزمية',
      signature: 'التوقيع',
      vertices: 'الرؤوس',
      edges: 'الحواف',
      graphHash: 'تجزئة الرسم البياني',
      policy: 'السياسة',
      declared: 'تاريخ الإعلان',
      status: 'الحالة',
      constraint: 'القيد',
      verified: 'تم التحقق',
      temporalPrecedence: 'الأسبقية الزمنية',
      poiDeclared: 'تاريخ إعلان القصد',
      decision: 'القرار',
      inferenceRelationships: 'علاقة استنتاجية',
      premises: 'مقدمات',
      rules: 'قواعد',
      conclusions: 'استنتاجات',
      legendPremise: 'مقدمة (بيانات مُلاحظة)',
      legendRule: 'قاعدة (من السياسة)',
      legendConclusion: 'استنتاج (مُشتق)',
      disclaimer: 'هذا عرض بحثي لنظام صنع القرار القابل للتحقق. غير مخصص للاستخدام الفعلي.',
      yes: 'نعم',
      no: 'لا',
    },
    tr: {
      triadicTitle: 'OpLogica Üçlü Doğrulama',
      parameter: 'Parametre',
      value: 'Değer',
      reasoningChain: 'Akıl Yürütme Zinciri — Tam Kural Değerlendirmesi',
      ruleHeader: 'Kural',
      inputHeader: 'Girdi',
      resultHeader: 'Sonuç',
      triggered: 'TETİKLENDİ',
      notTriggered: '—',
      reasonGraph: 'Akıl Yürütme Grafiği',
      pooTitle: 'İşlem Kanıtı (PoO) — genişletmek için tıklayın',
      porTitle: 'Gerekçe Kanıtı (PoR) — hash ve yapı',
      poiTitle: 'Niyet Kanıtı (PoI) — kısıtlamalar',
      hash: 'Hash',
      timestamp: 'Zaman Damgası',
      algorithm: 'Algoritma',
      signature: 'İmza',
      vertices: 'Düğümler',
      edges: 'Kenarlar',
      graphHash: 'Grafik Hash',
      policy: 'Politika',
      declared: 'İlan Tarihi',
      status: 'Durum',
      constraint: 'Kısıtlama',
      verified: 'DOĞRULANDI',
      temporalPrecedence: 'Zamansal Öncelik',
      poiDeclared: 'PoI ilan tarihi',
      decision: 'Karar',
      inferenceRelationships: 'çıkarım ilişkisi',
      premises: 'öncüller',
      rules: 'kurallar',
      conclusions: 'sonuçlar',
      legendPremise: 'Öncül (Gözlemlenen Veri)',
      legendRule: 'Kural (Politikadan)',
      legendConclusion: 'Sonuç (Türetilmiş)',
      disclaimer: 'Bu, doğrulanabilir yapay zeka karar verme sürecinin bir araştırma gösterimidir. Gerçek kullanım için tasarlanmamıştır.',
      yes: 'Evet',
      no: 'Hayır',
    }
  },

  triage: {
    en: {
      systemTitle: 'Medical Triage',
      critical: 'Critical',
      urgency: 'Urgency',
      reassessment: 'Reassessment',
      yes: 'YES',
      no: 'NO',
      required: 'Required',
      notRequired: 'Not needed',
      immediate: 'IMMEDIATE',
      soon: 'SOON',
      routine: 'ROUTINE',
      highPriority: 'HIGH PRIORITY',
      highPrioritySub: 'Immediate attention required',
      mediumPriority: 'MEDIUM PRIORITY',
      mediumPrioritySub: 'Elevated risk — monitor',
      lowPriority: 'LOW PRIORITY',
      lowPrioritySub: 'Standard priority',
      policyName: 'Emergency Triage Protocol v2.1',
    },
    ar: {
      systemTitle: 'الفرز الطبي',
      critical: 'حرج',
      urgency: 'الاستعجال',
      reassessment: 'إعادة التقييم',
      yes: 'نعم',
      no: 'لا',
      required: 'مطلوب',
      notRequired: 'غير مطلوب',
      immediate: 'فوري',
      soon: 'قريباً',
      routine: 'روتيني',
      highPriority: 'أولوية عالية',
      highPrioritySub: 'يتطلب اهتماماً فورياً',
      mediumPriority: 'أولوية متوسطة',
      mediumPrioritySub: 'يتطلب مراقبة',
      lowPriority: 'أولوية منخفضة',
      lowPrioritySub: 'معالجة عادية',
      policyName: 'بروتوكول الفرز الطارئ الإصدار 2.1',
    },
    tr: {
      systemTitle: 'Tıbbi Triyaj',
      critical: 'Kritik',
      urgency: 'Aciliyet',
      reassessment: 'Yeniden Değerlendirme',
      yes: 'EVET',
      no: 'HAYIR',
      required: 'Gerekli',
      notRequired: 'Gerekli Değil',
      immediate: 'ACİL',
      soon: 'YAKIN',
      routine: 'RUTİN',
      highPriority: 'YÜKSEK ÖNCELİK',
      highPrioritySub: 'Acil müdahale gerekli',
      mediumPriority: 'ORTA ÖNCELİK',
      mediumPrioritySub: 'Yüksek risk — izle',
      lowPriority: 'DÜŞÜK ÖNCELİK',
      lowPrioritySub: 'Standart işlem',
      policyName: 'Acil Triyaj Protokolü v2.1',
    }
  },

  credit: {
    en: {
      systemTitle: 'Financial Credit Assessment',
      recommendation: 'Recommendation',
      riskLevel: 'Risk Level',
      riskScore: 'Risk Score',
      interestTier: 'Interest Rate Tier',
      approved: 'APPROVED',
      denied: 'DENIED',
      manualReview: 'MANUAL REVIEW',
      approvedSub: 'Meets policy thresholds',
      deniedSub: 'Does not meet policy',
      manualReviewSub: 'Borderline — human review',
      policyName: 'Fair Lending Assessment Policy v1.0',
    },
    ar: {
      systemTitle: 'تقييم الائتمان المالي',
      recommendation: 'التوصية',
      riskLevel: 'مستوى المخاطر',
      riskScore: 'درجة المخاطر',
      interestTier: 'فئة معدل الفائدة',
      approved: 'مُوافق عليه',
      denied: 'مرفوض',
      manualReview: 'مراجعة يدوية',
      approvedSub: 'يستوفي جميع المعايير',
      deniedSub: 'لا يستوفي المتطلبات',
      manualReviewSub: 'يتطلب مراجعة إضافية',
      policyName: 'سياسة تقييم الإقراض العادل الإصدار 1.0',
    },
    tr: {
      systemTitle: 'Mali Kredi Değerlendirmesi',
      recommendation: 'Öneri',
      riskLevel: 'Risk Seviyesi',
      riskScore: 'Risk Puanı',
      interestTier: 'Faiz Oranı Sınıfı',
      approved: 'ONAYLANDI',
      denied: 'REDDEDİLDİ',
      manualReview: 'MANUEL İNCELEME',
      approvedSub: 'Tüm kriterleri karşılıyor',
      deniedSub: 'Gereksinimleri karşılamıyor',
      manualReviewSub: 'Ek inceleme gerekli',
      policyName: 'Adil Kredi Değerlendirme Politikası v1.0',
    }
  },

  hiring: {
    en: {
      systemTitle: 'Employment Screening',
      recommendation: 'Recommendation',
      compositeScore: 'Composite Score',
      candidateTier: 'Candidate Tier',
      recommended: 'RECOMMENDED',
      notRecommended: 'NOT RECOMMENDED',
      furtherReview: 'FURTHER REVIEW',
      recommendedSub: 'Meets policy thresholds',
      notRecommendedSub: 'Does not meet policy',
      furtherReviewSub: 'Borderline — human review',
      policyName: 'Fair Employment Screening Policy v1.0',
    },
    ar: {
      systemTitle: 'فرز التوظيف',
      recommendation: 'التوصية',
      compositeScore: 'الدرجة المركبة',
      candidateTier: 'فئة المرشح',
      recommended: 'مُوصى به',
      notRecommended: 'غير مُوصى به',
      furtherReview: 'مراجعة إضافية',
      recommendedSub: 'مرشح قوي',
      notRecommendedSub: 'لا يستوفي المعايير',
      furtherReviewSub: 'يحتاج تقييماً إضافياً',
      policyName: 'سياسة فرز التوظيف العادل الإصدار 1.0',
    },
    tr: {
      systemTitle: 'İstihdam Taraması',
      recommendation: 'Öneri',
      compositeScore: 'Bileşik Puan',
      candidateTier: 'Aday Sınıfı',
      recommended: 'TAVSİYE EDİLDİ',
      notRecommended: 'TAVSİYE EDİLMEDİ',
      furtherReview: 'EK İNCELEME',
      recommendedSub: 'Güçlü aday',
      notRecommendedSub: 'Kriterleri karşılamıyor',
      furtherReviewSub: 'Ek değerlendirme gerekli',
      policyName: 'Adil İstihdam Tarama Politikası v1.0',
    }
  },

  permit: {
    en: {
      systemTitle: 'Building Permit Assessment',
      recommendation: 'Recommendation',
      permitScore: 'Permit Score',
      permitClass: 'Permit Class',
      approved: 'APPROVED',
      denied: 'DENIED',
      conditional: 'CONDITIONAL APPROVAL',
      approvedSub: 'Meets all requirements',
      deniedSub: 'Does not meet requirements',
      conditionalSub: 'Requires modifications',
      policyName: 'Municipal Building Permit Policy v1.0',
    },
    ar: {
      systemTitle: 'تقييم تصاريح البناء',
      recommendation: 'التوصية',
      permitScore: 'درجة التصريح',
      permitClass: 'فئة التصريح',
      approved: 'مُوافق عليه',
      denied: 'مرفوض',
      conditional: 'موافقة مشروطة',
      approvedSub: 'يستوفي جميع المتطلبات',
      deniedSub: 'لا يستوفي المتطلبات',
      conditionalSub: 'يتطلب تعديلات',
      policyName: 'سياسة تصاريح البناء البلدية الإصدار 1.0',
    },
    tr: {
      systemTitle: 'İnşaat İzni Değerlendirmesi',
      recommendation: 'Öneri',
      permitScore: 'İzin Puanı',
      permitClass: 'İzin Sınıfı',
      approved: 'ONAYLANDI',
      denied: 'REDDEDİLDİ',
      conditional: 'KOŞULLU ONAY',
      approvedSub: 'Tüm gereksinimleri karşılıyor',
      deniedSub: 'Gereksinimleri karşılamıyor',
      conditionalSub: 'Değişiklikler gerekli',
      policyName: 'Belediye İnşaat İzni Politikası v1.0',
    }
  }
};

/**
 * Detects the language of a message.
 * Returns 'ar' for Arabic, 'tr' for Turkish, 'en' for English (default).
 */
function detectLanguage(message) {
  if (!message) return 'en';
  const str = String(message);
  const arabicChars = (str.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length;
  const turkishChars = (str.match(/[çÇğĞıİöÖşŞüÜ]/g) || []).length;
  const totalChars = (str.match(/[a-zA-Z\u0600-\u06FF\u0750-\u077F\u08A0-\u08FFçÇğĞıİöÖşŞüÜ]/g) || []).length;

  if (totalChars === 0) return 'en';
  if (arabicChars / totalChars > 0.3) return 'ar';
  if (turkishChars > 2) return 'tr';
  return 'en';
}

/**
 * Gets translation for a given system and language.
 * Falls back to English if translation is missing.
 */
function t(system, key, lang) {
  lang = lang || 'en';
  if (translations[system] && translations[system][lang] && translations[system][lang][key]) {
    return translations[system][lang][key];
  }
  if (translations[system] && translations[system]['en'] && translations[system]['en'][key]) {
    return translations[system]['en'][key];
  }
  return key;
}

module.exports = { translations, detectLanguage, t };
