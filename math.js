let currentMode = '';

// UI Navigation
function openCalculator(mode, modeName) {
    currentMode = mode;
    document.getElementById('screen-1').style.display = 'none';
    document.getElementById('screen-2').style.display = 'flex';
    document.getElementById('mode-title').innerText = `MODE: ${modeName}`;
    
    const inputElement = document.getElementById('math-input');
    if (mode === 'elimination' || mode === 'substitution') {
        inputElement.placeholder = "Paste system of equations here...";
    } else if (mode === 'distribute' || mode === 'fractions') {
        inputElement.placeholder = "Paste linear equation here...";
    } else {
        inputElement.placeholder = "Paste or type expression here... and press Enter";
    }
    
    inputElement.focus();
}

function goBack() {
    document.getElementById('screen-2').style.display = 'none';
    document.getElementById('screen-1').style.display = 'flex';
    document.getElementById('chat-box').innerHTML = ''; 
    document.getElementById('math-input').value = '';
}

// Input Handling
const inputField = document.getElementById('math-input');
const chatBox = document.getElementById('chat-box');

inputField.addEventListener('input', function() {
    this.value = this.value.replace(/\^2/g, '²');
});

inputField.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        const query = this.value.trim();
        if (query === '') return;
        
        this.value = '';
        processQuery(query);
    }
});

function processQuery(query) {
    appendMessage(`User: ${query}`);
    appendMessage(`System: Thinking...`);

    setTimeout(() => {
        const result = processMathUniversal(query, currentMode);
        
        const sysContainer = document.createElement('div');
        sysContainer.className = 'message-row';
        const sysMsg = document.createElement('div');
        sysMsg.className = 'message';

        if (result.isError) {
            const randNum = Math.floor(Math.random() * (500 - 50 + 1)) + 50;
            sysMsg.innerHTML = `System: (<span class="error-text">Error ${randNum}:</span> Math Parsing Failed) Ensure the format matches the current mode.`;
        } else {
            sysMsg.innerHTML = `System:<br>${result.displayHTML}`;
            
            if (!result.hideDefaultCopy) {
                sysMsg.innerHTML += ` <button class="copy-btn" onclick="copyResult(this, '${result.copyText}')">📋 Copy Answer</button>`;
            }
        }
        
        sysContainer.appendChild(sysMsg);
        chatBox.appendChild(sysContainer);
        
        const separatorRow = document.createElement('div');
        separatorRow.className = 'message-row';
        const separator = document.createElement('div');
        separator.className = 'separator';
        separator.innerText = '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~';
        separatorRow.appendChild(separator);
        chatBox.appendChild(separatorRow);

        chatBox.scrollTop = chatBox.scrollHeight;
    }, 800);
}

function appendMessage(text) {
    const row = document.createElement('div');
    row.className = 'message-row';
    const msg = document.createElement('div');
    msg.className = 'message';
    msg.innerText = text;
    row.appendChild(msg);
    chatBox.appendChild(row);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function copyResult(button, text) {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = button.innerHTML;
        button.innerHTML = '✅ Copied!';
        setTimeout(() => {
            button.innerHTML = originalText;
        }, 2000);
    });
}

// --- ALGEBRAIC MATH ENGINE ---

function simplifyFraction(n, d) {
    if (n === 0) return "0";
    let sign = (n < 0) !== (d < 0) ? "-" : "";
    n = Math.abs(n);
    d = Math.abs(d);
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    let divisor = gcd(n, d);
    n /= divisor;
    d /= divisor;
    return d === 1 ? `${sign}${n}` : `${sign}${n}/${d}`;
}

// Convert decimals to exact fractions
function toFraction(decimal) {
    if (decimal % 1 === 0) return decimal.toString();
    const tolerance = 1.0E-6;
    let sign = decimal < 0 ? "-" : "";
    let x = Math.abs(decimal);
    for (let i = 1; i <= 1000; i++) {
        let num = Math.round(x * i);
        if (Math.abs((num / i) - x) < tolerance) {
            return sign + num + "/" + i;
        }
    }
    return Number(decimal.toFixed(4)).toString(); 
}

// Evaluates x values for linear equations
function evaluateSide(expr, xValue) {
    let jsExpr = expr
        .replace(/([0-9])([a-zA-Z\(])/g, "$1*$2") 
        .replace(/\)([\w\(])/g, ")*$1")           
        .replace(/([a-zA-Z])([0-9\(\)])/g, "$1*$2"); 
    jsExpr = jsExpr.replace(/x/g, `(${xValue})`);
    try {
        return Function(`"use strict"; return (${jsExpr})`)();
    } catch (e) {
        return null;
    }
}

// Cleans up DeltaMath's broken fraction formatting
function sanitizeDeltaMathInput(input) {
    let cleaned = input.replace(/(\d+)\n\n(\d+)\n/g, "$2/$1"); // fixes 1\n\n2\n to 2/1 (which represents 1/2)
    cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF\s]/g, "");
    cleaned = cleaned.replace(/[−–—]/g, "-");
    return cleaned;
}

function processMathUniversal(input, mode) {
    try {
        // --- NEW: Linear Equations w/ Distribution & Fractions ---
        if (mode === 'distribute' || mode === 'fractions') {
            let eq = mode === 'fractions' ? sanitizeDeltaMathInput(input) : input.replace(/[−–—]/g, '-').replace(/\s+/g, '');
            let parts = eq.split('=');
            if (parts.length !== 2) return { isError: true };
            
            let L0 = evaluateSide(parts[0], 0);
            let R0 = evaluateSide(parts[1], 0);
            if (L0 === null || R0 === null) return { isError: true };
            let b = L0 - R0;
            
            let L1 = evaluateSide(parts[0], 1);
            let R1 = evaluateSide(parts[1], 1);
            let m = (L1 - R1) - b;
            
            if (m === 0) return { isError: true };
            
            let xVal = -b / m;
            let finalX = toFraction(xVal);
            
            return {
                isError: false,
                hideDefaultCopy: false,
                displayHTML: `Linear Solved:<br><span class="highlight-text">x = ${finalX}</span>`,
                copyText: finalX
            };
        }

        // --- Elimination & Substitution ---
        if (mode === 'elimination' || mode === 'substitution') {
            let cleanStr = input.replace(/[−–—]/g, '-').replace(/\s*=\s*/g, '=');
            let strParts = cleanStr.split(/\s+/);
            
            let eqsStr = strParts.filter(p => p.includes('=') && !/[a-z]{2,}/i.test(p) && !p.includes(','));
            
            if (eqsStr.length < 2) {
                let alt = input.toLowerCase().replace(/\s+and\s+/g, '|').replace(/\s+/g, '').replace(/[−–—]/g, '-');
                eqsStr = alt.split('|');
            }
            
            if (eqsStr.length !== 2) return { isError: true };

            function standardizeLinear(eq) {
                let splitEq = eq.split('=');
                if(splitEq.length !== 2) return null;
                let left = splitEq[0], right = splitEq[1];
                let a = 0, b = 0, c = 0;
                
                function parseExpr(expr, multiplier) {
                    expr = expr.replace(/(^[+-]?|[+-])/g, " $1").trim(); 
                    if (!expr) return;
                    let terms = expr.split(/\s+/);
                    terms.forEach(term => {
                        if (term.includes('x')) {
                            let val = term.replace('x', '');
                            a += (val === '+' || val === '') ? multiplier : (val === '-' ? -multiplier : parseInt(val) * multiplier);
                        } else if (term.includes('y')) {
                            let val = term.replace('y', '');
                            b += (val === '+' || val === '') ? multiplier : (val === '-' ? -multiplier : parseInt(val) * multiplier);
                        } else {
                            if(term !== '+' && term !== '-' && term !== '') {
                                c += parseInt(term) * multiplier;
                            }
                        }
                    });
                }
                
                parseExpr(left, 1);
                parseExpr(right, -1);
                return { a, b, c: -c }; 
            }

            let eq1 = standardizeLinear(eqsStr[0]);
            let eq2 = standardizeLinear(eqsStr[1]);

            if (!eq1 || !eq2) return { isError: true };

            let D = (eq1.a * eq2.b) - (eq2.a * eq1.b);
            if (D === 0) return { isError: true }; 

            let Dx = (eq1.c * eq2.b) - (eq2.c * eq1.b);
            let Dy = (eq1.a * eq2.c) - (eq2.a * eq1.c);

            let x = simplifyFraction(Dx, D);
            let y = simplifyFraction(Dy, D);
            
            return {
                isError: false,
                hideDefaultCopy: true,
                displayHTML: `System Solved:<br><span class="highlight-text">(${x}, ${y})</span><br><br>
                <button class="copy-btn" onclick="copyResult(this, '${x}')">📋 Copy X</button> 
                <button class="copy-btn" onclick="copyResult(this, '${y}')">📋 Copy Y</button>`
            };
        }

        // --- Quadratics (Factoring and Solving) ---
        function parsePolynomialSide(str) {
            let a = 0, b = 0, c = 0;
            if (!str.startsWith('-') && !str.startsWith('+')) str = '+' + str;
            
            const termRegex = /([+-]\d*x\^2|[+-]\d*x(?!\^2)|[+-]\d+)/g;
            let matches = str.match(termRegex);
            
            if (matches) {
                matches.forEach(term => {
                    if (term.includes('x^2')) {
                        let val = term.replace('x^2', '');
                        a += (val === '+' || val === '') ? 1 : (val === '-' ? -1 : parseInt(val));
                    } else if (term.includes('x')) {
                        let val = term.replace('x', '');
                        b += (val === '+' || val === '') ? 1 : (val === '-' ? -1 : parseInt(val));
                    } else {
                        c += parseInt(term);
                    }
                });
            }
            return { a, b, c };
        }

        let expr = input.replace(/\s+/g, '').replace(/²/g, '^2').replace(/[−–—]/g, '-').replace(/x2/g, 'x^2');
        let parts = expr.split('=');
        
        let lhs = parsePolynomialSide(parts[0]);
        let a = lhs.a, b = lhs.b, c = lhs.c;

        if (parts.length > 1) {
            let rhs = parsePolynomialSide(parts[1]);
            a -= rhs.a;
            b -= rhs.b;
            c -= rhs.c;
        }

        if (mode === 'factor_a1' || mode === 'solve_a1') {
            if (a !== 1) return { isError: true };
        }
        if (a === 0) return { isError: true }; 

        const gcdHelper = (x, y) => {
            x = Math.abs(x); y = Math.abs(y);
            while(y) { let t = y; y = x % y; x = t; }
            return x;
        };

        let g = gcdHelper(a, gcdHelper(b, c));
        if (a < 0) g = -g; 
        
        let a1 = a / g, b1 = b / g, c1 = c / g;
        let targetMult = a1 * c1, targetAdd = b1;
        let f1 = null, f2 = null;

        if (targetMult === 0) {
            f1 = targetAdd; f2 = 0;
        } else {
            let limit = Math.abs(targetMult);
            for (let i = -limit; i <= limit; i++) {
                if (i === 0) continue;
                if (targetMult % i === 0) {
                    let j = targetMult / i;
                    if (i + j === targetAdd) {
                        f1 = i; f2 = j; break;
                    }
                }
            }
        }

        if (f1 === null) return { isError: true };

        let gcd1 = gcdHelper(a1, f1);
        let t1_a = a1 / gcd1, t1_c = f1 / gcd1;

        let gcd2 = gcdHelper(a1, f2);
        let t2_a = a1 / gcd2, t2_c = f2 / gcd2;

        const formatBin = (coef, cnst) => {
            if (coef === 0 && cnst === 0) return '';
            let xT = coef === 1 ? 'x' : (coef === -1 ? '-x' : `${coef}x`);
            if (coef === 0) xT = '';
            if (cnst === 0) return xT;
            if (coef === 0) return cnst.toString();
            let cT = cnst > 0 ? `+ ${cnst}` : `- ${Math.abs(cnst)}`;
            return `(${xT} ${cT})`;
        };

        let b1Str = formatBin(t1_a, t1_c);
        let b2Str = formatBin(t2_a, t2_c);
        
        if (t1_a === 1 && t1_c === 0) b1Str = 'x';
        if (t2_a === 1 && t2_c === 0) b2Str = 'x';
        
        if (b1Str.startsWith('(') && !b2Str.startsWith('(')) {
            let temp = b1Str; b1Str = b2Str; b2Str = temp;
        }

        let gStr = g === 1 ? '' : (g === -1 ? '-' : g.toString());
        let factoredForm = `${gStr}${b1Str}${b2Str}`;

        if (mode.startsWith('solve')) {
            let discriminant = b*b - 4*a*c;
            if (discriminant < 0) return { isError: true }; 
            
            let sqrtD = Math.sqrt(discriminant);
            let n1 = -b + sqrtD;
            let n2 = -b - sqrtD;
            let den = 2 * a;

            let root1 = simplifyFraction(n1, den);
            let root2 = simplifyFraction(n2, den);
            
            let solutions = (root1 === root2) ? `${root1}` : `${root1}, ${root2}`;
            
            return { 
                isError: false, 
                displayHTML: `Factored: ${factoredForm} = 0<br>Solutions: <span class="highlight-text">x = ${solutions}</span>`, 
                copyText: solutions 
            };
        } else {
            return { 
                isError: false, 
                displayHTML: `<span class="highlight-text">${factoredForm}</span>`, 
                copyText: factoredForm.replace(/\\/g, '\\\\') 
            };
        }
        
    } catch(e) {
        return { isError: true };
    }
}
