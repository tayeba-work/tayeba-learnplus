/**
 * Smart Regex-based parser for messy telesales text.
 * Handles Bengali and English numbers, extracts name, phone, address, product, and price.
 * Fully supports Bengali and English text detection, with a massive database of 64 districts in both languages.
 */

const BN_TO_EN_MAP = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
};

/**
 * Converts Bengali digits in a string to English digits.
 */
export function convertBnToEnNumbers(text) {
  if (!text) return '';
  return text.replace(/[০-৯]/g, d => BN_TO_EN_MAP[d]);
}

/**
 * Parses unstructured text to extract customer details.
 * @param {string} rawText - The raw paste text.
 * @param {Array<object>} knownProducts - List of standard products to scan for.
 * @returns {object} Parsed customer order info.
 */
export function parseMessyText(rawText, knownProducts = []) {
  if (!rawText) return { name: '', phone: '', address: '', productName: '', price: '', notes: '' };

  // Normalize Bengali numbers to English numbers first
  const text = convertBnToEnNumbers(rawText);
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  let phone = '';
  let name = '';
  let address = '';
  let productName = '';
  let price = '';
  let notes = [];

  // Define regexes for explicit labels (English and Bengali support)
  const nameLabels = /^(?:name|customer|কাস্টমার\s*নাম|কাস্টমার\s*নেম|নাম|ক্রেতা|recipient|receiver)\s*[:：\-\=]\s*(.*)$/i;
  const phoneLabels = /^(?:phone|mobile|call|ফোন|মোবাইল|নাম্বার|যোগাযোগ|contact|ph)\s*[:：\-\=]\s*(.*)$/i;
  const addressLabels = /^(?:address|location|ঠিকানা|বাসা|ডেলিভারি\s*ঠিকানা|delivery\s*address|addr)\s*[:：\-\=]\s*(.*)$/i;
  const productLabels = /^(?:product|item|প্রোডাক্ট|বই|আইটেম|পণ্য|course)\s*[:：\-\=]\s*(.*)$/i;
  const priceLabels = /^(?:price|cost|amount|দাম|টাকা|মূল্য|টাকাঃ|pricing)\s*[:：\-\=]\s*(\d+)(.*)$/i;

  // 1. EXTRACT PHONE NUMBER
  // Standard BD Mobile numbers: 013, 014, 015, 016, 017, 018, 019
  const cleanPhoneCandidate = text.replace(/[-–—\s()]/g, '');
  const phoneMatch = cleanPhoneCandidate.match(/(?:\+?88)?(01[3-9]\d{8})/);
  if (phoneMatch) {
    phone = phoneMatch[1];
  }

  // 2. CLEAN PHONE OUT OF LINES FOR BETTER HEURISTICS
  const cleanedLines = lines.map(line => {
    let clean = line;
    if (phone) {
      const escapedPhone = phone.replace(/[-–—\s()]/g, '');
      const phoneRegex = new RegExp(`(?:\\+?88)?[-–—\\s()]*${escapedPhone.split('').join('[-–—\\s()]*')}[-–—\\s()]*`, 'g');
      clean = clean.replace(phoneRegex, ' ');
    }
    // Clean symbols
    clean = clean.replace(/[:：\-\=\(\)\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
    return clean;
  }).filter(line => line.length > 0);

  // 3. SEARCH BY EXPLICIT LABELS (Using original lines to match structural labels)
  let labelFoundName = false;
  let labelFoundAddress = false;
  let labelFoundProduct = false;
  let labelFoundPrice = false;

  lines.forEach(line => {
    if (nameLabels.test(line)) {
      name = line.match(nameLabels)[1].trim();
      labelFoundName = true;
    }
    else if (phoneLabels.test(line)) {
      const val = line.match(phoneLabels)[1].replace(/[-–—\s()]/g, '').trim();
      const phMatch = val.match(/(?:\+?88)?(01[3-9]\d{8})/);
      if (phMatch) {
        phone = phMatch[1];
      } else {
        phone = val;
      }
    }
    else if (addressLabels.test(line)) {
      address = line.match(addressLabels)[1].trim();
      labelFoundAddress = true;
    }
    else if (productLabels.test(line)) {
      productName = line.match(productLabels)[1].trim();
      labelFoundProduct = true;
    }
    else if (priceLabels.test(line)) {
      price = line.match(priceLabels)[1].trim();
      labelFoundPrice = true;
    }
  });

  // 4. SCAN FOR KNOWN PRODUCTS
  if (!productName && knownProducts.length > 0) {
    for (const p of knownProducts) {
      const regex = new RegExp(p.name, 'i');
      if (regex.test(text)) {
        productName = p.name;
        if (!price && p.price) {
          price = p.price.toString();
        }
        break;
      }
    }
  }

  // 5. HEURISTICS FOR PRICE IF NOT FOUND
  if (!price) {
    const priceSuffixMatch = text.match(/(\d{3,5})\s*(?:tk|taka|টাকা|\/-)/i);
    if (priceSuffixMatch) {
      price = priceSuffixMatch[1];
    } else {
      const standaloneNumbers = text.match(/\b\d{3,5}\b/g) || [];
      const filtered = standaloneNumbers.filter(num => {
        if (phone && phone.includes(num)) return false;
        return true;
      });
      if (filtered.length > 0) {
        price = filtered[0];
      }
    }
  }

  // Comprehensive BD districts and address tags in English & Bengali (64 Districts + Admin subdivisions)
  const addressKeywords = /dhaka|faridpur|gazipur|gopalganj|kishoreganj|madaripur|manikganj|munshiganj|narayanganj|narsingdi|rajbari|shariatpur|shoriatpur|tangail|barishal|barisal|barguna|bhola|jhalokati|patuakhali|pirojpur|bandarban|brahmanbaria|chandpur|chattogram|chittagong|cumilla|comilla|cox|feni|khagrachhari|lakshmipur|noakhali|rangamati|bagerhat|chuadanga|jashore|jessore|jhenaidah|khulna|kushtia|magura|meherpur|narail|satkhira|jamalpur|mymensingh|netrokona|sherpur|bogura|bogra|joypurhat|naogaon|natore|chapainawabganj|nawabganj|pabna|rajshahi|sirajganj|dinajpur|gaibandha|kurigram|lalmonirhat|nilphamari|panchagarh|rangpur|thakurgaon|habiganj|moulvibazar|sunamganj|sylhet|ঢাকা|চট্টগ্রাম|সিলেট|রাজশাহী|খুলনা|বরিশাল|রংপুর|ময়মনসিংহ|ফরিদপুর|গাজীপুর|গোপালগঞ্জ|কিশোরগঞ্জ|مাদারীপুর|মানিকগঞ্জ|মুন্সীগঞ্জ|নারায়ণগঞ্জ|নরসিংদী|রাজবাড়ী|শরীয়তপুর|টাঙ্গাইল|বরগুনা|ভোলা|ঝালকাঠি|পটুয়াখালী|পিরোজপুর|বান্দরবান|ব্রাহ্মণবাড়িয়া|চাঁদপুর|কুমিল্লা|কক্সবাজার|ফেনী|খাগড়াছড়ি|লক্ষ্মীপুর|নোয়াখালী|রাঙ্গামাটি|বাগেরহাট|চুয়াডাঙ্গা|যশোর|ঝিনাইদহ|কুষ্টিয়া|মাগুরা|মেহেরপুর|নড়াইল|সাতক্ষীরা|জামালপুর|নেত্রকোণা|শেরপুর|বগুড়া|জয়পুরহাট|নওগাঁ|নাটোর|চাঁপাইনবাবগঞ্জ|পাবনা|সিরাজগঞ্জ|দিনাজপুর|গাইবান্ধা|কুড়িগ্রাম|লালমনিরহাট|নীলফামারী|পঞ্চগড়|ঠাকুরগাঁও|হবিগঞ্জ|মৌলভীবাজার|সুনামগঞ্জ|ঠিকানা|বাসা|রোড|গ্রাম|থানা|উপজেলা|বিভাগ|পৌরসভা|মহল্লা|পাড়া|ইউনিয়ন|ওয়ার্ড|পোস্ট|পোস্ট\s*অফিস|কুরিয়ার|কুরিয়ার|ডেলিভারি|বাজার|মোড়|মোড়|চৌরাস্তা|স্ট্যান্ড|block|road|house|flat|floor|village|thana|district|ward|union|delivery|jela|zila|upozila|upazila|stand|bazar|goli|lane|mor|moor|chowrasta|station/i;

  const productKeywords = /course|book|software|suite|premium|interactive|ordered|bought|বই|কোর্স|সফটওয়্যার|অর্ডার|পণ্য|আইটেম/i;

  // 6. PHONE-SPLITTER NAME HEURISTIC (Highest confidence for phone in middle of address & name, e.g. "Dhaka 017xx Ruhul")
  if (!name && phone) {
    for (const line of lines) {
      const cleanPhoneCandidate = line.replace(/[-–—\s()]/g, '');
      if (cleanPhoneCandidate.includes(phone)) {
        const escapedPhone = phone.replace(/[-–—\s()]/g, '');
        const phoneRegex = new RegExp(`(?:\\+?88)?[-–—\\s()]*${escapedPhone.split('').join('[-–—\\s()]*')}[-–—\\s()]*`, 'g');
        const parts = line.split(phoneRegex);
        
        for (const part of parts) {
          if (!part) continue;
          let cleanPart = part.replace(/[:：\-\=\(\)\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
          
          if (cleanPart && cleanPart.length >= 3 && cleanPart.length <= 25) {
            const words = cleanPart.split(' ').filter(Boolean);
            if (words.length >= 1 && words.length <= 4 && !addressKeywords.test(cleanPart) && !productKeywords.test(cleanPart)) {
              name = cleanPart;
              break;
            }
          }
        }
        if (name) break;
      }
    }
  }

  // 7. SAME-LINE NAME HEURISTIC (Fallback for phone + name on same line - English & Bengali)
  if (!name && phone) {
    for (const line of lines) {
      const cleanPhoneCandidate = line.replace(/[-–—\s()]/g, '');
      if (cleanPhoneCandidate.includes(phone)) {
        const escapedPhone = phone.replace(/[-–—\s()]/g, '');
        const phoneRegex = new RegExp(`(?:\\+?88)?[-–—\\s()]*${escapedPhone.split('').join('[-–—\\s()]*')}[-–—\\s()]*`, 'g');
        let namePart = line.replace(phoneRegex, ' ');
        namePart = namePart.replace(/[:：\-\=\(\)\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
        
        if (namePart && namePart.length >= 3 && namePart.length <= 30) {
          const words = namePart.split(' ').filter(Boolean);
          if (words.length >= 1 && words.length <= 5 && !addressKeywords.test(namePart) && !productKeywords.test(namePart)) {
            name = namePart;
            break;
          }
        }
      }
    }
  }

  // 8. MULTI-FIELD SPLITTER HEURISTIC (If name is on the same line as address/action keywords, e.g. "Ruhul lives in Dhaka")
  if (!name) {
    const splitterKeywords = /\b(?:lives\s+in|in|at|from)\b|\b(?:থাকে|বাসা|ঠিকানা|কুরিয়ার|কুরিয়ার|ডেলিভারি|অর্ডার|নিবে)\b/i;
    
    for (const line of lines) {
      if (phone && line.replace(/[-–—\s()]/g, '').includes(phone)) continue;
      
      if (splitterKeywords.test(line) && addressKeywords.test(line)) {
        const parts = line.split(splitterKeywords);
        if (parts.length > 0) {
          let leftPart = parts[0].replace(/[:：\-\=\(\)\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
          
          if (leftPart && leftPart.length >= 3 && leftPart.length <= 30) {
            const words = leftPart.split(' ').filter(Boolean);
            if (words.length >= 1 && words.length <= 5 && !addressKeywords.test(leftPart) && !productKeywords.test(leftPart)) {
              name = leftPart;
              break;
            }
          }
        }
      }
    }
  }

  // 9. HEURISTICS FOR NAME (If same-line extraction or label name was not matched)
  if (!name) {
    for (const cleanLine of cleanedLines) {
      if (addressKeywords.test(cleanLine)) continue;
      if (productKeywords.test(cleanLine)) continue;
      if (/^\d+\s*\w*$/.test(cleanLine)) continue;
      if (cleanLine.length > 35) continue;
      if (cleanLine.length < 3) continue;

      name = cleanLine;
      break;
    }
  }

  // 10. HEURISTICS FOR ADDRESS (If no label address was matched)
  if (!address) {
    const addressLines = lines.map((line, idx) => {
      let cleanLine = cleanedLines[idx] || '';
      
      // If this line contains the extracted name, clean it out of the address!
      if (name && (line.toLowerCase().includes(name.toLowerCase()) || cleanLine.toLowerCase().includes(name.toLowerCase())) && !labelFoundName) {
        const nameRegex = new RegExp(name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
        cleanLine = cleanLine.replace(nameRegex, ' ').replace(/\s+/g, ' ').trim();
        
        // Clean phone labels or mobile terms (separating Bengali and English to avoid word boundary issues)
        cleanLine = cleanLine.replace(/(?:মোবাইল|মোবাইল\s*নম্বর|মোবাইল\s*নাম্বার|মোবাইল\s*নং|ফোন|ফোন\s*নম্বর|ফোন\s*নাম্বার|যোগাযোগ)/g, ' ');
        cleanLine = cleanLine.replace(/\b(?:phone|mobile|contact|call|ph)\b/gi, ' ');
        
        // Clean common dividers that might remain
        cleanLine = cleanLine.replace(/(?:lives\s+in|in|at|from|থাকে|বাসা|ঠিকানা|কুরিয়ার|ডেলিভারি|অর্ডার|নিবে)/g, ' ');
        
        cleanLine = cleanLine.replace(/\s+/g, ' ').trim();
        
        if (cleanLine.length < 5 && !addressKeywords.test(cleanLine)) return null;
      }
      
      if (phone && line.replace(/[-–—\s()]/g, '').includes(phone)) {
        if (!addressKeywords.test(cleanLine)) return null;
      }
      
      if (/^\d+\s*(?:tk|taka|টাকা|\/-)?$/i.test(line)) return null;
      if (nameLabels.test(line) || phoneLabels.test(line) || productLabels.test(line) || priceLabels.test(line)) return null;
      
      if (addressKeywords.test(line) || cleanLine.length > 25) {
        return cleanLine;
      }
      return null;
    }).filter(l => l !== null);

    if (addressLines.length > 0) {
      address = addressLines.join(', ');
    }
  }

  // 11. PRODUCT & NOTES HEURISTICS
  lines.forEach((line, idx) => {
    const cleanLine = cleanedLines[idx] || '';
    
    const isLabelLine = nameLabels.test(line) || 
                        phoneLabels.test(line) || 
                        addressLabels.test(line) || 
                        productLabels.test(line) || 
                        priceLabels.test(line);
    if (isLabelLine) return;

    if (phone && line.replace(/[-–—\s()]/g, '').includes(phone) && cleanLine.length < 3) return;
    if (name && (line.toLowerCase().includes(name.toLowerCase()) || cleanLine.toLowerCase().includes(name.toLowerCase())) && cleanLine.length < 25) return;
    if (address && (address.toLowerCase().includes(line.toLowerCase()) || address.toLowerCase().includes(cleanLine.toLowerCase()))) return;
    if (productName && line.toLowerCase().includes(productName.toLowerCase())) return;
    if (price && line.includes(price)) return;
    
    if (!productName && !labelFoundProduct && cleanLine.length < 35 && cleanLine.length > 3 && !addressKeywords.test(cleanLine) && !productKeywords.test(cleanLine)) {
      productName = cleanLine;
    } else {
      notes.push(line);
    }
  });

  return {
    name: name.replace(/[:：\-]$/, '').trim(),
    phone,
    address: address.replace(/[:：\-]$/, '').trim(),
    productName: productName.replace(/[:：\-]$/, '').trim(),
    price: price ? parseInt(price, 10).toString() : '',
    notes: notes.join(' | ')
  };
}

/**
 * Formats order data into standard text structure for copying to delivery portals
 */
export function formatForCourier(order) {
  if (!order) return '';
  return `Name: ${order.name || ''}\nPhone: ${order.phone || ''}\nAddress: ${order.address || ''}\nProduct: ${order.productName || ''}\nPrice: ${order.price || '0'} TK`;
}

/**
 * Plays a pleasant double-chime success sound using Web Audio API synthesis
 */
export function playSuccessSound() {
  if (localStorage.getItem('telesales_sound_enabled') === 'false') return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 chime
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1); // A5 chime
    
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.35);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.warn("Chime playback blocked or not supported:", e);
  }
}
