let currentMode = '';

// UI Navigation
function openCalculator(mode, modeName) {
    currentMode = mode;
    document.getElementById('screen-1').style.display = 'none';
    document.getElementById('screen-2').style.display = 'flex';
    document.getElementById('mode-title').innerText = `MODE: ${modeName}`;
    
    const inputElement = document.getElementById('math-input');
    if (mode === 'elimination') {
        inputElement.placeholder = "Paste system (e.g., -x+2y=-2 and 6x-y=-43)...";
    } else if (mode.startsWith('solve')) {
        inputElement.placeholder = "Paste or type equation here... and press Enter";
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

        // --- NEW: Custom Copy Button Logic ---
        if (result.isError) {
            const randNum = Math.floor(Math.random() * (500 - 50 + 1)) + 50;
            sysMsg.innerHTML = `System: (<span class="error-text">Error ${randNum}:</span> Math Parsing Failed) Ensure the format matches the current mode.`;
        } else {
            sysMsg.innerHTML = `System:<br>${result.displayHTML}`;
            
            // Only add the default copy button if hideDefaultCopy isn't true
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

function parseLinearEquation(eq) {
    let parts = eq.split('=');
    if (parts.length !== 2) return null;
    let left = parts[0];
    let rightStr = parts[1].replace(/[−–—]/g, '-').trim();
    let c = parseInt(rightStr);

    let a = 0, b = 0;
    let terms = left.match(/([+-]?\d*[xy])/g);
    if (!terms) return null;

    terms.forEach(term => {
        if (term.includes('x')) {
            let val = term.replace('x', '');
            a += (val === '+' || val === '') ? 1 : (val === '-' ? -1 : parseInt(val));
        } else if (term.includes('y')) {
            let val = term.replace('y', '');
            b += (val === '+' || val === '') ? 1 : (val === '-' ? -1 : parseInt(val));
        }
    });
    return { a, b, c };
}

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

function processMathUniversal(input, mode) {
    try {
        if (mode === 'elimination') {
            let cleanStr = input.toLowerCase().replace(/\s+and\s+/g, '|').replace(/\./g, '').replace(/\s+/g, '').replace(/[−–—]/g, '-');
            let eqs = cleanStr.split('|');
            
            if (eqs.length !== 2) return { isError: true };

            let eq1 = parseLinearEquation(eqs[0]);
            let eq2 = parseLinearEquation(eqs[1]);

            if (!eq1 || !eq2) return { isError: true };

            let D = (eq1.a * eq2.b) - (eq2.a * eq1.b);
            if (D === 0) return { isError: true }; 

            let Dx = (eq1.c * eq2.b) - (eq2.c * eq1.b);
            let Dy = (eq1.a * eq2.c) - (eq2.a * eq1.c);

            let x = simplifyFraction(Dx, D);
            let y = simplifyFraction(Dy, D);
            
            // --- NEW: Injecting Two Copy Buttons ---
            return {
                isError: false,
                hideDefaultCopy: true,
                displayHTML: `System Solved:<br><span class="highlight-text">(${x}, ${y})</span><br><br>
                <button class="copy-btn" onclick="copyResult(this, '${x}')">📋 Copy X</button> 
                <button class="copy-btn" onclick="copyResult(this, '${y}')">📋 Copy Y</button>`
            };
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
