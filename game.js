const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statsUI = document.getElementById('playerStats');
const levelUI = document.getElementById('levelInfo');
const msgUI = document.getElementById('msg-box');
const lvlupUI = document.getElementById('lvlup-overlay');

// Dialog & Shop UI elements
const dialogBox = document.getElementById('dialog-box');
const dialogName = document.getElementById('dialog-name');
const dialogText = document.getElementById('dialog-text');
const choicesBox = document.getElementById('choices-box');
const shopOverlay = document.getElementById('shop-overlay');
const shopGold = document.getElementById('shop-gold');
const shopItems = document.getElementById('shop-items');

// INPUT STATE
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('keypress', e => {
    if(game.state === 'dialog') {
        if((e.code === 'KeyE' || e.key === 'e') && !dialog.isTyping && dialog.choices.length === 0) {
            dialog.next();
        } else if((e.code === 'KeyE' || e.key === 'e') && dialog.isTyping) {
            dialog.skipTyping();
        }
        return; 
    }

    if(game.state === 'playing') {
        if(e.code === 'KeyQ' || e.key === 'q') player.swapWeapon();
        if(e.code === 'Space') player.attack();
        if(e.code === 'KeyE' || e.key === 'e') game.interact();
        
        if(player.statPoints > 0) {
            if(e.code === 'Digit1') player.addStat('STR');
            if(e.code === 'Digit2') player.addStat('INT');
            if(e.code === 'Digit3') player.addStat('AGI');
        }
    }
});

// GLOBAL VARIABLES
const GRAVITY = 0.4;
let scrollX = 0; 
let shake = 0;
let particles = [];
let projectiles = [];
let enemies = [];
let platforms = [];
let portals = [];
let items = [];
let floatingTexts = [];
let npcs = [];

let currentMapData = null;

// UTILITY FUNCTIONS
function msg(text, time=3000) { 
    msgUI.innerText = text; 
    setTimeout(() => { if(msgUI.innerText === text) msgUI.innerText=''; }, time); 
}
function checkCol(r1, r2) {
    return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
}
function addParticle(x, y, color, count, speed=1.5) {
    for(let i=0; i<count; i++) {
        particles.push({
            x:x, y:y, vx:(Math.random()-0.5)*speed*2, vy:(Math.random()-0.5)*speed*2,
            life: 1.0, color:color, size: Math.random()*4+2
        });
    }
}
function addText(x, y, text, color) {
    floatingTexts.push({x, y, text, color, life: 1.0});
}
function lerpColor(c1, c2, t) {
    t = Math.max(0, Math.min(1, t));
    let r1 = parseInt(c1.substring(1,3), 16), g1 = parseInt(c1.substring(3,5), 16), b1 = parseInt(c1.substring(5,7), 16);
    let r2 = parseInt(c2.substring(1,3), 16), g2 = parseInt(c2.substring(3,5), 16), b2 = parseInt(c2.substring(5,7), 16);
    let r = Math.round(r1 + (r2 - r1) * t), g = Math.round(g1 + (g2 - g1) * t), b = Math.round(b1 + (b2 - b1) * t);
    return `#${(r<<16 | g<<8 | b).toString(16).padStart(6, '0')}`;
}

// DATABASE SENJATA & ITEM
const weaponsDB = [
    { id: 0, name: "Ranting Patah", type: "melee", dmg: 3, range: 40, strScale: 0.5, intScale: 0, color: "#8B4513" },
    { id: 1, name: "Pedang Berkarat", type: "melee", dmg: 10, range: 60, strScale: 1.5, intScale: 0, color: "#bdc3c7" },
    { id: 2, name: "Tongkat Pemula", type: "ranged", dmg: 5, range: 350, strScale: 0, intScale: 2.0, color: "#9b59b6" },
    { id: 3, name: "Pedang Vektor (Legendary)", type: "melee", dmg: 50, range: 80, strScale: 3.0, intScale: 0.5, color: "#f39c12" }, // Chapter 4
    { id: 4, name: "Tombak Kutukan", type: "melee", dmg: 70, range: 100, strScale: 4.0, intScale: 1.0, color: "#e74c3c" }, // Shop
    { id: 5, name: "Staf Abyss", type: "ranged", dmg: 40, range: 500, strScale: 0, intScale: 4.5, color: "#8e44ad" } // Shop
];

// ITEM DROP
class ItemDrop {
    constructor(x, y, wpId) {
        this.x=x; this.y=y; this.w=20; this.h=20; this.wpId = wpId;
        this.wp = weaponsDB.find(w => w.id === wpId);
        this.vy = 0;
    }
    update() {
        this.vy += GRAVITY; this.y += this.vy;
        platforms.forEach(p => { 
            if(checkCol(this, p) && this.vy>0) { this.y=p.y-this.h; this.vy=0; }
        });
        
        if(checkCol(this, player)) {
            if (!player.weapons.includes(this.wpId)) {
                player.weapons.push(this.wpId);
                msg(`DAPAT SENJATA BARU: ${this.wp.name}! Tekan Q untuk Equip.`, 5000);
            }
            this.active = false;
        }
    }
    draw() {
        let px = this.x - scrollX;
        ctx.fillStyle = this.wp.color; ctx.fillRect(px, this.y, this.w, this.h);
        ctx.fillStyle = "white"; ctx.font="10px Arial"; ctx.fillText("ITEM", px-2, this.y-5);
    }
}

// NPC CLASS
class NPC {
    constructor(id, x, y, name, color, w=30, h=40) {
        this.id = id; this.x=x; this.y=y; this.w=w; this.h=h; this.name=name; this.color=color;
    }
    draw() {
        let px = this.x - scrollX;
        ctx.fillStyle = this.color; ctx.fillRect(px, this.y, this.w, this.h);
        ctx.fillStyle = "white"; ctx.font="bold 12px Arial"; ctx.textAlign="center";
        ctx.fillText(this.name, px+this.w/2, this.y-10);
        ctx.textAlign="left"; // reset
        
        // Indikator bisa interaksi jika dekat
        if(game.state === 'playing' && Math.abs((player.x + player.w/2) - (this.x + this.w/2)) < 60) {
            ctx.fillStyle = "#f1c40f"; ctx.fillText("[E] Bicara", px-5, this.y-25);
        }
    }
}

// DIALOGUE ENGINE
const dialog = {
    queue: [],
    currentText: "",
    idx: 0,
    isTyping: false,
    interval: null,
    choices: [],
    callback: null,

    start(messages, choices=[], onFinish=null) {
        game.state = 'dialog';
        this.queue = messages;
        this.choices = choices;
        this.callback = onFinish;
        this.idx = 0;
        dialogBox.style.display = 'block';
        choicesBox.style.display = 'none';
        this.showCurrent();
    },
    
    showCurrent() {
        if(this.idx >= this.queue.length) {
            if(this.choices.length > 0) {
                this.showChoices();
            } else {
                this.close();
            }
            return;
        }
        let msg = this.queue[this.idx];
        dialogName.innerText = msg.name;
        dialogName.style.color = msg.color || "#f39c12";
        dialogText.innerHTML = "";
        
        this.isTyping = true;
        let charIdx = 0;
        clearInterval(this.interval);
        this.interval = setInterval(() => {
            dialogText.innerHTML += msg.text.charAt(charIdx);
            charIdx++;
            if(charIdx >= msg.text.length) {
                clearInterval(this.interval);
                this.isTyping = false;
            }
        }, 20); // Kecepatan ketik
    },
    
    skipTyping() {
        clearInterval(this.interval);
        dialogText.innerHTML = this.queue[this.idx].text;
        this.isTyping = false;
    },
    
    next() {
        this.idx++;
        this.showCurrent();
    },
    
    showChoices() {
        choicesBox.innerHTML = '';
        this.choices.forEach(c => {
            let btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.innerText = c.text;
            btn.onclick = () => {
                choicesBox.style.display = 'none';
                if(c.action) c.action();
            };
            choicesBox.appendChild(btn);
        });
        choicesBox.style.display = 'flex';
    },

    close() {
        dialogBox.style.display = 'none';
        choicesBox.style.display = 'none';
        game.state = 'playing';
        if(this.callback) this.callback();
    }
};

// PLAYER
class Player {
    constructor() {
        this.w = 26; this.h = 36;
        this.spawn(100, 300);
        
        this.lvl = 1; this.xp = 0; this.maxXp = 50;
        this.hp = 50; this.maxHp = 50; 
        this.str = 5; this.int = 5; this.agi = 0;
        this.statPoints = 0;
        this.gold = 0; // Tambahan Gold
        
        this.weapons = [0];
        this.weaponIdx = 0; 
        this.cd = 0;
    }
    
    get currentSpeed() { return 2.5 + (this.agi * 0.2); }
    get currentJump() { return -8.0 - (this.agi * 0.25); }
    
    spawn(x, y) { 
        this.x = x; this.y = y; 
        this.vx = 0; this.vy = 0; 
        this.grounded = false; this.dir = 1; 
    }
    
    get weapon() { return weaponsDB.find(w => w.id === this.weapons[this.weaponIdx]); }
    
    swapWeapon() {
        if(this.weapons.length <= 1) return;
        this.weaponIdx = (this.weaponIdx + 1) % this.weapons.length;
        this.updateUI(); 
        msg(`Ganti Senjata: ${this.weapon.name}`);
    }
    
    getDmg() { return Math.floor(this.weapon.dmg + this.str*this.weapon.strScale + this.int*this.weapon.intScale); }
    
    gainXp(amt) {
        this.xp += amt;
        addText(this.x, this.y-30, `+${amt} XP`, "#9b59b6");
        while(this.xp >= this.maxXp) {
            this.xp -= this.maxXp;
            this.lvl++;
            this.maxXp = Math.floor(this.maxXp * 1.5);
            this.statPoints++;
            this.maxHp += 10; this.hp = this.maxHp;
            addParticle(this.x+15, this.y+20, "#f1c40f", 40, 4);
            lvlupUI.style.display = 'flex';
            game.state = 'lvlup'; // Pause saat level up
        }
        this.updateUI();
    }

    gainGold(amt) {
        this.gold += amt;
        addText(this.x+20, this.y-20, `+${amt}G`, "#f1c40f");
        this.updateUI();
    }
    
    addStat(type) {
        if(this.statPoints <= 0) return;
        if(type === 'STR') this.str += 5;
        if(type === 'INT') this.int += 5;
        if(type === 'AGI') this.agi += 2;
        this.statPoints--;
        if(this.statPoints <= 0) {
            lvlupUI.style.display = 'none';
            game.state = 'playing';
        }
        this.updateUI();
    }
    
    updateUI() {
        let xpPct = Math.min(100, (this.xp / this.maxXp) * 100);
        statsUI.innerHTML = `
        <b>LVL: ${this.lvl}</b> <div class="xp-bar-bg"><div class="xp-bar-fill" style="width:${xpPct}%"></div></div>
        <span style="color:#2ecc71"><b>HP:</b> ${this.hp}/${this.maxHp}</span> | 
        <span style="color:#f1c40f"><b>Gold:</b> ${this.gold}G</span><br>
        <span style="color:#e74c3c"><b>STR:</b> ${this.str}</span> | <span style="color:#3498db"><b>INT:</b> ${this.int}</span> | <span style="color:#f39c12"><b>AGI:</b> ${this.agi}</span><br>
        <b>Senjata:</b> <span style="color:${this.weapon.color}">${this.weapon.name}</span> (DMG: ${this.getDmg()})`;
    }
    
    attack() {
        if(this.cd > 0) return;
        this.cd = Math.max(15, 35 - this.agi); 
        let dmg = this.getDmg();
        
        if(this.weapon.type === 'melee') {
            let bx = this.dir === 1 ? this.x + this.w : this.x - this.weapon.range;
            let atkBox = { x: bx, y: this.y, w: this.weapon.range, h: this.h };
            
            ctx.fillStyle = "rgba(255,255,255,0.6)";
            ctx.fillRect(atkBox.x - scrollX, atkBox.y, atkBox.w, atkBox.h);
            
            enemies.forEach(e => {
                if(e.hp > 0 && checkCol(atkBox, e)) {
                    e.takeDmg(dmg); addParticle(e.x+e.w/2, e.y+e.h/2, "#fff", 8);
                }
            });
        } else {
            projectiles.push(new Proj(this.x+this.w/2, this.y+10, this.dir*(8+this.agi*0.2), dmg, this.weapon.range, this.weapon.color, true));
        }
    }
    
    takeDmg(amt) {
        if(game.chapter === 2 && game.level === 20) {
            // Scripted loss di Chapter 2 (Mati sekali hit)
            this.hp = 0;
        } else {
            this.hp -= amt; 
        }
        addText(this.x, this.y-20, `-${amt}`, "#e74c3c");
        
        if(this.hp <= 0) {
            if(game.chapter === 2 && game.level === 20) {
                // Scripted loss event
                msg("Kekuatan Jenderal terlalu dahsyat... Semuanya menjadi gelap...", 4000);
                game.chapter = 3; // Lanjut ke bab 3
                this.hp = this.maxHp;
                setTimeout(() => game.loadLevel(0), 3000);
            } else {
                msg("MAAF, ANDA MATI. Kembali ke Lobby...");
                this.hp = this.maxHp; this.xp = 0;
                // Penalitas Gold?
                this.gold = Math.floor(this.gold * 0.8);
                setTimeout(() => game.loadLevel(0), 2000);
            }
        }
        this.updateUI();
    }
    
    update() {
        if(game.state !== 'playing') return;
        
        if(keys['KeyA'] || keys['ArrowLeft']) { this.vx = -this.currentSpeed; this.dir = -1; }
        else if(keys['KeyD'] || keys['ArrowRight']) { this.vx = this.currentSpeed; this.dir = 1; }
        else this.vx = 0;
        
        if((keys['KeyW'] || keys['ArrowUp']) && this.grounded) {
            this.vy = this.currentJump; this.grounded = false;
        }
        
        this.vy += GRAVITY; this.x += this.vx; this.y += this.vy;
        
        if(this.y > 1000) this.takeDmg(100); 
        
        this.grounded = false;
        platforms.forEach(p => {
            if(checkCol(this, p) && this.vy > 0 && this.y + this.h - this.vy <= p.y) {
                this.y = p.y - this.h; this.vy = 0; this.grounded = true;
            }
        });
        if(this.x < 0) this.x = 0;
        if(this.cd > 0) this.cd--;
    }
    
    draw() {
        let px = this.x - scrollX;
        // Warna MC berubah agak gelap jika bad ending triggered
        ctx.fillStyle = game.ending === 'bad' ? "#111" : "#3498db"; 
        ctx.fillRect(px, this.y, this.w, this.h);
        ctx.fillStyle = game.ending === 'bad' ? "red" : "white"; // Mata merah
        ctx.fillRect(px + (this.dir===1?16:4), this.y+6, 6, 6);
        ctx.fillStyle = this.weapon.color;
        if(this.weapon.type === 'melee') ctx.fillRect(px + (this.dir===1?15:-5), this.y+15, 20, 4);
        else ctx.fillRect(px + (this.dir===1?15:-15), this.y+12, 30, 4);
    }
}

// PROYEKTIL & ENEMY
class Proj {
    constructor(x,y,vx,dmg,rng,col,isPlayer) {
        this.x=x; this.y=y; this.vx=vx; this.dmg=dmg; this.rng=rng; this.startX=x; 
        this.col=col; this.isPlayer=isPlayer; this.w=10; this.h=10; this.active=true;
    }
    update() {
        if(game.state !== 'playing') return;
        this.x += this.vx;
        if(Math.abs(this.x-this.startX) > this.rng) this.active = false;
        
        platforms.forEach(p => { if(checkCol(this, p)) this.active = false; });

        addParticle(this.x, this.y, this.col, 1, 0.5);
        if(this.isPlayer) {
            enemies.forEach(e => { if(e.hp>0 && checkCol(this, e)) { e.takeDmg(this.dmg); this.active=false; }});
        } else {
            if(checkCol(this, player)) { player.takeDmg(this.dmg); this.active=false; }
        }
    }
    draw() {
        if(!this.active) return;
        ctx.fillStyle = this.col; ctx.beginPath(); ctx.arc((this.x - scrollX)+5, this.y+5, 5, 0, Math.PI*2); ctx.fill();
    }
}

class Enemy {
    constructor(x, y, type, isBoss=false, minX=null, maxX=null) {
        this.x=x; this.y=y; this.startX=x; this.startY=y; this.type=type; this.isBoss=isBoss;
        this.hp=30; this.maxHp=30; this.vx=-1; this.vy=0; 
        this.w=26; this.h=36; this.col="#e74c3c";
        this.atkCd = 0; this.xpDrop = 20; this.goldDrop = 10;
        this.minX = minX !== null ? minX : x - 150;
        this.maxX = maxX !== null ? maxX : x + 150;
        this.setupType();
    }
    
    setupType() {
        if(this.type === 'goblin') { this.col="#2ecc71"; this.w=26; this.h=30; this.hp=30; this.goldDrop=5;}
        if(this.type === 'bat') { this.col="#8e44ad"; this.w=20; this.h=20; this.hp=20; this.xpDrop=30; this.goldDrop=8;}
        
        if(this.isBoss) {
            this.w=70; this.h=70; this.maxHp=300; this.hp=300; this.xpDrop=200; this.goldDrop = 150;
            if(this.type === 'General') { this.col = "#2c3e50"; this.w=50; this.h=70; this.maxHp=99999; this.hp=99999; } // Invincible Chapter 2
            if(this.type === 'SlimeKing') { this.col = "rgba(46, 204, 113, 0.8)"; }
            if(this.type === 'Golem') { this.col = "#7f8c8d"; this.maxHp=500; this.hp=500; }
            if(this.type === 'Assassin') { this.col = "#2c3e50"; this.w=35; this.h=65; this.maxHp=400; this.hp=400; }
            if(this.type === 'Warlock') { this.col = "#c0392b"; this.w=40; this.h=65; }
            if(this.type === 'DemonKing') { this.col = "#000"; this.w=100; this.h=120; this.maxHp=2000; this.hp=2000; this.xpDrop=1000; this.goldDrop=500;}
        }
    }
    
    takeDmg(amt) {
        if(this.type === 'General' && game.chapter === 2) {
            addText(this.x+this.w/2, this.y, "0", "#fff");
            return; // Invincible
        }
        
        this.hp -= amt; addText(this.x+this.w/2, this.y, amt, "#fff");
        this.x += (player.x < this.x) ? 5 : -5;
        if(this.hp <= 0) {
            addParticle(this.x+this.w/2, this.y+this.h/2, this.col, 30, 4);
            player.gainXp(this.xpDrop);
            player.gainGold(this.goldDrop);
            
            if(this.isBoss) {
                if(this.type === 'DemonKing') {
                    // Memicu Ending
                    triggerEnding();
                } else {
                    msg(`🔥 BOSS ${this.type} KALAH! KEMBALI KE LOBBY... 🔥`, 5000);
                    if(game.chapter === 5 && this.type === 'SlimeKing') game.chapter = 6;
                    setTimeout(() => game.loadLevel(0), 4000);
                }
            }
        }
    }
    
    update() {
        if(game.state !== 'playing' || this.hp <= 0) return;
        
        if(!this.isBoss) {
            this.x += this.vx;
            if(this.type === 'bat') this.y = this.startY + Math.sin(Date.now()/300)*40;
            
            if(this.x <= this.minX) { this.x = this.minX; this.vx = Math.abs(this.vx); }
            else if(this.x + this.w >= this.maxX) { this.x = this.maxX - this.w; this.vx = -Math.abs(this.vx); }
        } else {
            this.atkCd--;
            if(this.type === 'General') {
                if(this.atkCd <= 0) { this.x = player.x; this.y = player.y; this.atkCd=50; } // TP and kill
            }
            if(this.type === 'SlimeKing') {
                if(this.atkCd <= 0) { this.vy = -10; this.vx = (player.x < this.x) ? -3 : 3; this.atkCd = 120; }
                this.vy += GRAVITY; this.x += this.vx; this.y += this.vy;
                platforms.forEach(p => { if(checkCol(this, p) && this.vy>0) { this.y=p.y-this.h; this.vy=0; this.vx=0;} });
            }
            if(this.type === 'Golem') {
                if(this.atkCd <= 0) { projectiles.push(new Proj(this.x, this.y+20, -4, 20, 600, "#95a5a6", false)); this.atkCd = 100; }
            }
            if(this.type === 'Assassin') {
                if(this.atkCd <= 0) {
                    addParticle(this.x, this.y, "#000", 20);
                    this.x = player.x + (Math.random()>0.5 ? 80 : -80); this.y = player.y - 10;
                    this.atkCd = 100;
                }
            }
            if(this.type === 'Warlock') {
                if(this.atkCd <= 0) {
                    projectiles.push(new Proj(this.x, this.y+20, -6, 15, 800, "#e74c3c", false));
                    projectiles.push(new Proj(this.x, this.y+40, -6, 15, 800, "#f1c40f", false));
                    this.atkCd = 70;
                }
            }
            if(this.type === 'DemonKing') {
                this.y = 100 + Math.sin(Date.now()/600)*50;
                this.x += (player.x + 250 - this.x) * 0.01; 
                if(this.atkCd <= 0) { 
                    projectiles.push(new Proj(this.x, this.y+this.h, -10, 40, 1000, "#9b59b6", false)); 
                    projectiles.push(new Proj(this.x, this.y+this.h, -10, 40, 1000, "#e74c3c", false)); 
                    this.atkCd = 40; 
                }
            }
        }
        
        if(checkCol(this, player) && this.hp > 0) {
            player.takeDmg(this.type === 'General' ? 999 : (this.isBoss ? 15 : 5));
            player.x += (player.x < this.x) ? -30 : 30;
        }
    }
    
    draw() {
        if(this.hp <= 0) return;
        let px = this.x - scrollX;
        ctx.fillStyle = this.col; ctx.fillRect(px, this.y, this.w, this.h);
        if(this.isBoss) { ctx.fillStyle="red"; ctx.fillRect(px+10, this.y+15, 10,8); ctx.fillRect(px+this.w-20, this.y+15, 10,8); }
        ctx.fillStyle = "red"; ctx.fillRect(px, this.y-10, this.w, 4);
        ctx.fillStyle = "#2ecc71"; ctx.fillRect(px, this.y-10, this.w * (this.hp/this.maxHp), 4);
        if(this.isBoss) { ctx.fillStyle = "white"; ctx.font="bold 12px Arial"; ctx.fillText(this.type, px, this.y-15); }
    }
}

// PORTAL
class Portal {
    constructor(x, y, targetLvl, text, requiredChapter=0) { 
        this.x=x; this.y=y; this.w=60; this.h=80; this.target=targetLvl; this.text=text; this.req = requiredChapter;
    }
    draw() {
        let px = this.x - scrollX;
        let color = game.chapter >= this.req ? "#3498db" : "#7f8c8d";
        ctx.fillStyle = game.chapter >= this.req ? "rgba(41, 128, 185, 0.5)" : "rgba(100, 100, 100, 0.5)"; 
        ctx.fillRect(px, this.y, this.w, this.h);
        ctx.fillStyle = color; ctx.fillRect(px+5, this.y+5, this.w-10, this.h-10);
        ctx.fillStyle = "white"; ctx.font="bold 14px Arial"; 
        
        let displayTxt = game.chapter >= this.req ? this.text : "(Terkunci)";
        ctx.fillText(displayTxt, px-10, this.y-15);
    }
}

function generateLevel(cfg) {
    let plats = []; let enems = []; let itms = []; let decos = [];
    plats.push({x: -500, y: 450, w: 1000, h: 200, c1: cfg.pCol[0], c2: cfg.pCol[1]}); 
    
    let curX = 500; let lastY = 450;
    while(curX < cfg.len) {
        let type = Math.random();
        let pGap = 0.25; let pPlat = 0.6;
        if(cfg.id === 2) { pGap = 0.1; pPlat = 0.8; } 
        if(cfg.id === 3) { pGap = 0.4; pPlat = 0.5; } 
        if(cfg.id === 4) { pGap = 0.1; pPlat = 0.9; } 
        
        if(Math.random() < 0.3) decos.push({x: curX + Math.random()*200, y: (cfg.id===2 ? 0 : 300), type: cfg.id});
        
        if(type < pGap) {
            let gap = 30 + Math.random()*30; curX += gap;
            plats.push({x: curX, y: 450, w: 300, h: 200, c1: cfg.pCol[0], c2: cfg.pCol[1]});
            if(Math.random() < 0.5) enems.push(new Enemy(curX + 150, 410, cfg.mob, false, curX, curX + 300));
            curX += 300; lastY = 450;
        } else if(type < pPlat) {
            let diffY = (Math.random() * 100) - 50; 
            let h = lastY + diffY;
            if(h > 450) h = 450; if(h < 200) h = 200; 
            let w = (cfg.id === 5) ? (100 + Math.random()*50) : (150 + Math.random()*100); 
            plats.push({x: curX, y: h, w: w, h: (cfg.id===4 ? 100:20), c1: cfg.pCol[0], c2: cfg.pCol[1]});
            if(Math.random() < 0.5) enems.push(new Enemy(curX + 20, h-40, cfg.mob, false, curX, curX + w));
            curX += w + (20 + Math.random()*30); lastY = h;
        } else {
            let h = 450; let w = 300 + Math.random()*200;
            plats.push({x: curX, y: h, w: w, h: 200, c1: cfg.pCol[0], c2: cfg.pCol[1]});
            if(Math.random() < 0.7) enems.push(new Enemy(curX + 150, h-40, cfg.mob, false, curX, curX + w));
            curX += w + (10 + Math.random()*20); lastY = h;
        }
    }
    
    plats.push({x: cfg.len, y: 450, w: 1500, h: 200, c1: cfg.pCol[0], c2: cfg.pCol[1]});
    if(cfg.id === 1) itms.push(new ItemDrop(cfg.len + 100, 300, 1)); 
    if(cfg.id === 2) itms.push(new ItemDrop(cfg.len + 100, 300, 2)); 
    return { platforms: plats, enemies: enems, items: itms, decos: decos, bossX: cfg.len + 400, bossType: cfg.type, bg: cfg.bg };
}

// GAME STATE & STORY LOGIC
const game = {
    level: 0,
    chapter: 0, // 0: Prolog, 1: Guild, 2: Rushing General, 3: Searching Vektor, 4: Got sword, 5: Shop open, 6+: Loop
    state: 'playing', // playing, dialog, shop, lvlup
    bossState: 'none',
    bossTimer: 0,
    ending: null,
    
    init() { 
        player.updateUI(); 
        this.loadLevel(0); 
        gameLoop(); 
        this.startProlog();
    },

    startProlog() {
        // Cutscene Prolog
        dialog.start([
            {name: "Sistem", text: "Desa Oakhaven, tempat kelahiranmu yang damai...", color: "#fff"},
            {name: "Sistem", text: "Tiba-tiba direnggut oleh pasukan Demon King.", color: "#e74c3c"},
            {name: "MC", text: "Tidak... Semuanya hancur... Teman-teman, keluargaku...", color: "#3498db"},
            {name: "MC", text: "Aku akan membunuh mereka semua. Semuanya!!!", color: "#e74c3c"}
        ], [], () => {
            game.chapter = 1;
        });
    },
    
    loadLevel(lvlId) {
        this.level = lvlId;
        platforms = []; enemies = []; portals = []; projectiles = []; particles = []; items = []; floatingTexts = []; npcs = [];
        player.spawn(100, 300);
        this.state = 'playing';
        
        if(lvlId === 0) {
            levelUI.innerHTML = "🏛️ <b>Lobby (Reruntuhan Oakhaven)</b>";
            platforms.push({x:-1000, y:450, w:3000, h:200, c1:"#95a5a6", c2:"#7f8c8d"});
            
            // NPCS
            npcs.push(new NPC('npc1', -200, 410, "Pramuka Guild", "#2ecc71"));
            npcs.push(new NPC('npc2', 200, 410, "Guild Master", "#e67e22"));
            npcs.push(new NPC('npc3', -400, 410, "Vektor", "#8e44ad"));
            npcs.push(new NPC('npc4', 350, 410, "Navigator", "#3498db"));
            npcs.push(new NPC('npc5', -600, 410, "Pedagang Gelap", "#000"));

            // Portals
            portals.push(new Portal(500, 370, 20, "Markas Jenderal", 2)); // Portal khusus chapter 2 (Scripted loss)
            portals.push(new Portal(700, 370, 1, "Lv 1: Hutan Slime", 5));
            portals.push(new Portal(900, 370, 2, "Lv 2: Goa Golem", 6));
            portals.push(new Portal(1100,370, 3, "Lv 3: Markas Assassin", 6));
            portals.push(new Portal(1300,370, 4, "Lv 4: Menara Warlock", 6));
            portals.push(new Portal(1500,370, 5, "Lv 5: Sarang Naga", 6));
            portals.push(new Portal(1700,370, 6, "Markas Demon King", 6)); // Final
            
            currentMapData = { bg: ["#1a1a2e", "#1a1a2e"], bossX: 2000, decos: [] };
            this.bossState = 'none';
        }
        else if (lvlId === 20) {
            // Scripted Loss Area
            levelUI.innerHTML = "💀 <b>Markas Jenderal</b>";
            platforms.push({x:-1000, y:450, w:3000, h:200, c1:"#2c3e50", c2:"#000"});
            currentMapData = { bg: ["#300", "#000"], bossX: 800, decos: [] };
            this.bossState = 'spawning'; this.bossTimer = 60;
            currentMapData.bossType = 'General';
        }
        else {
            let config = {
                1: { id: 1, title: "🌲 Hutan Kematian", type: 'SlimeKing', len: 3000, mob: 'goblin', bg: ["#1a2a1a", "#2a0a0a"], pCol: ["#27ae60", "#2c3e50"] },
                2: { id: 2, title: "⛰️ Goa Golem", type: 'Golem', len: 4000, mob: 'bat', bg: ["#2c3e50", "#111111"], pCol: ["#7f8c8d", "#34495e"] },
                3: { id: 3, title: "⚔️ Markas Assassin", type: 'Assassin', len: 4500, mob: 'goblin', bg: ["#200000", "#400000"], pCol: ["#c0392b", "#8e44ad"] },
                4: { id: 4, title: "🔥 Menara Warlock", type: 'Warlock', len: 5000, mob: 'bat', bg: ["#301010", "#501010"], pCol: ["#d35400", "#c0392b"] },
                5: { id: 5, title: "🐉 Sarang Naga", type: 'DarkDragon', len: 6000, mob: 'bat', bg: ["#100020", "#300040"], pCol: ["#f1c40f", "#f39c12"] },
                6: { id: 6, title: "👑 Tahta Demon King", type: 'DemonKing', len: 8000, mob: 'bat', bg: ["#000", "#500"], pCol: ["#500", "#100"] }
            };
            levelUI.innerHTML = config[lvlId].title;
            msg(`Memasuki ${config[lvlId].title}...`, 4000);
            currentMapData = generateLevel(config[lvlId]);
            platforms = currentMapData.platforms; enemies = currentMapData.enemies; items = currentMapData.items;
            this.bossState = 'waiting';
        }
    },
    
    interact() {
        // Cek Interaksi dengan NPC
        let nearNPC = npcs.find(n => Math.abs((player.x + player.w/2) - (n.x + n.w/2)) < 60);
        if(nearNPC) {
            handleNPCDialog(nearNPC.id);
            return;
        }

        // Cek Portal
        portals.forEach(p => {
            if(checkCol({x:player.x, y:player.y, w:player.w, h:player.h}, p)) {
                if(game.chapter >= p.req) {
                    this.loadLevel(p.target);
                } else {
                    msg("Portal ini belum bisa diakses. Lanjutkan cerita terlebih dahulu.");
                }
            }
        });
    }
};

// LOGIKA CERITA & DIALOG
function handleNPCDialog(id) {
    if(id === 'npc2' && game.chapter === 1) {
        dialog.start([
            {name: "Guild Master", text: "Anak muda, mengayunkan pedang tanpa teknik hanya akan membuatmu mati konyol. Kenapa warga biasa sepertimu nekad menyerang sarang monster?", color: "#e67e22"},
            {name: "MC", text: "Mereka meratakan desa saya... membantai semua orang yang saya kenal. Saya tidak peduli harus mati, asal bisa menghabisi mereka semua!", color: "#3498db"},
            {name: "Guild Master", text: "Monster yang menghancurkan desamu bukan monster liar, tapi pasukan Demon King. Kalau mau balas dendam, daftarlah jadi petualang resmi.", color: "#e67e22"},
            {name: "Guild Master", text: "Tapi dengan kondisimu sekarang, kau tidak akan bertahan. Cobalah terobos markas mereka kalau kau tidak percaya. Aku sudah menandai koordinatnya.", color: "#e67e22"}
        ], [], () => { game.chapter = 2; msg("Portal Markas Jenderal Terbuka!"); });
    }
    else if(id === 'npc2' && game.chapter === 3) {
        dialog.start([
            {name: "Guild Master", text: "Sudah sadar? Syukurlah Pramuka kami menemukanmu.", color: "#e67e22"},
            {name: "MC", text: "Aku... terlalu lemah...", color: "#3498db"},
            {name: "Guild Master", text: "Kau butuh arahan. Temui Vektor di ujung barat. Dia satu-satunya yang pernah hidup setelah menembus benteng Demon King.", color: "#e67e22"}
        ]);
    }
    else if(id === 'npc3' && game.chapter === 3) {
        dialog.start([
            {name: "Vektor", text: "Jadi kamu 'si bodoh' yang nekat menantang Jenderal kemarin? Pergi dari sini. Aku tidak berminat bermain hero-heroan lagi.", color: "#8e44ad"},
            {name: "MC", text: "Tolong aku! Guild Master bilang cuma kamu yang pernah hampir sampai ke ruang Demon King!", color: "#3498db"},
            {name: "Vektor", text: "Kamu tahu kenapa aku masih hidup?! Karena teman-temanku mengorbankan nyawa mereka agar aku bisa kabur! Aku pengecut yang takut mati! Apa kamu mau bernasib sama seperti mereka?!", color: "#8e44ad"},
            {name: "MC", text: "Aku tidak punya siapa-siapa lagi untuk ditakuti hilangnya. Kalau kamu memilih sembunyi di sini, biarkan aku yang membawa sisa perjuangan teman-temanmu.", color: "#3498db"},
            {name: "Vektor", text: "...Gila. Kamu benar-benar orang gila yang sama. Ambil pedang tua ini. Jangan biarkan darah teman-temanku terbuang sia-sia lagi.", color: "#8e44ad"},
            {name: "Sistem", text: "Mendapatkan [Pedang Vektor (Legendary)]! Temui Navigator untuk membuka rute latihan.", color: "#f1c40f"}
        ], [], () => { 
            game.chapter = 4; 
            player.weapons.push(3); player.weaponIdx = player.weapons.length-1; player.updateUI();
        });
    }
    else if(id === 'npc4' && game.chapter === 4) {
        dialog.start([
            {name: "Navigator", text: "Oh, kau bocah yang diakui Vektor? Baiklah, aku sudah menandai zona 'grinding' di petamu.", color: "#3498db"},
            {name: "Navigator", text: "Kumpulkan emas dari monster, lalu temui Pedagang Gelap di sudut sana. Dia punya barang bagus.", color: "#3498db"}
        ], [], () => { game.chapter = 5; msg("Pedagang Gelap dan Area Level 1 Terbuka!"); });
    }
    else if(id === 'npc5' && game.chapter >= 5) {
        dialog.start([
            {name: "Pedagang Gelap", text: "Kecium bau darah monster segar... dan bau dendam yang pekat. Selamat datang, pemburu muda.", color: "#555"},
            {name: "MC", text: "Aku butuh senjata yang cukup kuat untuk menembus zirah pasukan Demon King.", color: "#3498db"},
            {name: "Pedagang Gelap", text: "Hehehe, segalanya ada harganya. Kumpulkan emas, dan aku akan memberimu barang-barang gelap... Tapi ingat, senjata terbaik pun tidak bisa menyelamatkan jiwa yang hancur.", color: "#555"}
        ], [], () => { openShop(); });
    }
    else {
        // Default text
        let msgs = {
            'npc1': "Tetap waspada, Nak. Monster berkeliaran di luar sana.",
            'npc2': "Berlatihlah yang keras. Balas dendam butuh kekuatan.",
            'npc3': "Jangan permalukan pedangku...",
            'npc4': "Lihat petamu, perhatikan langkahmu.",
            'npc5': "Hehehe... kembali lagi?"
        };
        dialog.start([{name: "NPC", text: msgs[id], color:"#aaa"}]);
    }
}

// ENDING LOGIC
function triggerEnding() {
    dialog.start([
        {name: "Sistem", text: "Demon King tumbang. Namun sosoknya menguap menjadi asap hitam...", color: "#fff"},
        {name: "Demon King", text: "Hahaha... Kau pikir ini berakhir? Aku bukanlah makhluk... Aku adalah dendam itu sendiri.", color: "#e74c3c"},
        {name: "Sistem", text: "Asap hitam pembawa kutukan itu melesat ke arahmu, mengincar hati yang penuh kebencian.", color: "#fff"}
    ], [
        {
            text: "Terima kekuatan itu. Mereka semua harus menderita sepertiku! (Revenge)",
            action: () => {
                game.ending = 'bad';
                dialog.start([
                    {name: "Sistem", text: "Kau membiarkan kebencian menelan kewarasanmu.", color: "#e74c3c"},
                    {name: "Demon MC", text: "Dunia ini busuk... Aku akan meratakan semuanya...", color: "#e74c3c"},
                    {name: "Sistem", text: "BAD ENDING: Lingkaran Setan. Kau menjadi Demon King berikutnya.", color: "#fff"}
                ], [], () => {
                    setTimeout(()=> window.location.reload(), 5000);
                });
            }
        },
        {
            text: "Tolak! Aku bertarung bukan hanya untuk balas dendam, tapi untuk melindungi orang-orang yang berjuang bersamaku! (Redemption)",
            action: () => {
                game.ending = 'good';
                dialog.start([
                    {name: "Sistem", text: "Cahaya dari tekad barumu membakar habis asap kutukan itu.", color: "#f1c40f"},
                    {name: "MC", text: "Desaku tidak akan kembali... Tapi aku bisa mencegah tragedi ini terjadi pada desa lain.", color: "#3498db"},
                    {name: "Sistem", text: "GOOD ENDING: Harapan Baru. Kau kembali sebagai pahlawan yang sebenarnya.", color: "#f1c40f"}
                ], [], () => {
                    setTimeout(()=> window.location.reload(), 5000);
                });
            }
        },
        {
            text: "Serap kekuatannya secara utuh dan kendalikan kutukannya. (Dominance)",
            action: () => {
                game.ending = 'dark'; // Secret Ending
                dialog.start([
                    {name: "Sistem", text: "Alih-alih ditelan kutukan, kekuatan batinmu mendominasi esensi Demon King.", color: "#8e44ad"},
                    {name: "Dark Lord MC", text: "Guild, Kerajaan, Demon... Kalian semua hanyalah pion. Sekarang, akulah aturannya.", color: "#8e44ad"},
                    {name: "Sistem", text: "SECRET ENDING: Penguasa Mutlak. Kau menyatukan umat manusia dan monster di bawah tirani yang absolut.", color: "#8e44ad"}
                ], [], () => {
                    setTimeout(()=> window.location.reload(), 5000);
                });
            }
        }
    ]);
}

// SHOP LOGIC
function openShop() {
    game.state = 'shop';
    shopOverlay.style.display = 'flex';
    shopGold.innerText = `Gold: ${player.gold}`;
    shopItems.innerHTML = `
        <div class="shop-item"><span>❤️ Potion HP Max (+20 HP)</span> <button class="buy-btn" onclick="buyItem('hp', 50)">Beli (50G)</button></div>
        <div class="shop-item"><span>💪 Steroid STR (+10 STR)</span> <button class="buy-btn" onclick="buyItem('str', 100)">Beli (100G)</button></div>
        <div class="shop-item"><span>🧠 Elixir INT (+10 INT)</span> <button class="buy-btn" onclick="buyItem('int', 100)">Beli (100G)</button></div>
        <div class="shop-item"><span>⚔️ Tombak Kutukan (DMG 70)</span> <button class="buy-btn" onclick="buyItem('w4', 500)">Beli (500G)</button></div>
        <div class="shop-item"><span>🔮 Staf Abyss (DMG 40, Range 500)</span> <button class="buy-btn" onclick="buyItem('w5', 600)">Beli (600G)</button></div>
    `;
}

window.closeShop = function() {
    shopOverlay.style.display = 'none';
    game.state = 'playing';
}

window.buyItem = function(type, cost) {
    if(player.gold < cost) {
        alert("Gold tidak cukup!");
        return;
    }
    
    if(type === 'w4' && player.weapons.includes(4)) { alert("Sudah punya senjata ini!"); return; }
    if(type === 'w5' && player.weapons.includes(5)) { alert("Sudah punya senjata ini!"); return; }

    player.gold -= cost;
    if(type === 'hp') { player.maxHp += 20; player.hp = player.maxHp; }
    if(type === 'str') player.str += 10;
    if(type === 'int') player.int += 10;
    if(type === 'w4') { player.weapons.push(4); msg("Dapat Tombak Kutukan!"); }
    if(type === 'w5') { player.weapons.push(5); msg("Dapat Staf Abyss!"); }
    
    player.updateUI();
    shopGold.innerText = `Gold: ${player.gold}`;
}

const player = new Player();

// LOOP
function gameLoop() {
    let progress = Math.min(1, player.x / currentMapData.bossX);
    let bgColor = lerpColor(currentMapData.bg[0], currentMapData.bg[1], progress);
    
    ctx.fillStyle = bgColor;
    ctx.fillRect(0,0, canvas.width, canvas.height);
    
    if(shake > 0) {
        ctx.save();
        ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake);
        shake--;
    } else {
        ctx.save();
    }
    
    let targetScrollX = player.x - canvas.width/3; 
    if(targetScrollX > currentMapData.bossX - canvas.width + 300) {
        targetScrollX = currentMapData.bossX - canvas.width + 300;
    }
    if(targetScrollX < 0) targetScrollX = 0;
    scrollX += (targetScrollX - scrollX) * 0.05; 
    
    if(currentMapData.decos) {
        currentMapData.decos.forEach(d => {
            let px = d.x - (scrollX * 0.5); 
            if(d.type === 1) { ctx.fillStyle = "#1e3a29"; ctx.fillRect(px, d.y+50, 40, 100); } 
            if(d.type === 2) { ctx.fillStyle = "#2c3e50"; ctx.beginPath(); ctx.moveTo(px,0); ctx.lineTo(px+30, 150); ctx.lineTo(px+60, 0); ctx.fill(); } 
            if(d.type === 3) { ctx.fillStyle = "#111"; ctx.fillRect(px, d.y-50, 80, 200); } 
            if(d.type === 4) { ctx.fillStyle = "#501010"; ctx.fillRect(px, d.y, 60, 300); } 
            if(d.type === 5) { ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.beginPath(); ctx.arc(px, d.y-100, 50, 0, Math.PI*2); ctx.fill(); } 
        });
    }

    // DRAW NPCs in Lobby
    if(game.level === 0) {
        npcs.forEach(n => n.draw());
    }
    
    if(game.level > 0 && game.bossState === 'waiting' && game.level !== 20) {
        let arenaStart = currentMapData.bossX - 500;
        if(player.x > arenaStart) {
            enemies = enemies.filter(e => e.isBoss);
            game.bossState = 'spawning';
            game.bossTimer = 180; 
        }
    }
    
    if(game.bossState === 'spawning') {
        game.bossTimer--;
        shake = 8; 
        
        let bx = currentMapData.bossX;
        let by = 300;
        addParticle(bx + (Math.random()-0.5)*150, by + (Math.random()-0.5)*150, "#f1c40f", 3, 6);
        addParticle(bx, by, "#e74c3c", 2, 8);
        
        ctx.fillStyle = "red"; ctx.font = "bold 40px Arial";
        ctx.fillText("⚠️ WARNING: BOSS APPROACHING ⚠️", 100, 200);
        
        if(game.bossTimer <= 0) {
            game.bossState = 'active';
            shake = 0;
            enemies.push(new Enemy(currentMapData.bossX, 350, currentMapData.bossType, true));
            if(currentMapData.bossType === 'General') {
                msg("JENDERAL DEMON KING MUNCUL! (Kekuatannya tidak terukur!)", 3000);
            } else {
                msg("BOSS MUNCUL! BERSIAPLAH!", 3000);
            }
        }
    }
    
    platforms.forEach(p => {
        let px = p.x - scrollX;
        ctx.fillStyle = p.c1; ctx.fillRect(px, p.y, p.w, p.h);
        ctx.fillStyle = p.c2; ctx.fillRect(px, p.y+10, p.w, p.h-10); 
    });
    
    portals.forEach(p => p.draw());
    items.forEach(i => { i.update(); i.draw(); i.active = i.active !== false; });
    items = items.filter(i => i.active !== false);
    
    player.update(); player.draw();
    
    projectiles.forEach(p => { p.update(); p.draw(); });
    projectiles = projectiles.filter(p => p.active);
    
    enemies.forEach(e => { e.update(); e.draw(); });
    enemies = enemies.filter(e => e.hp > 0); 
    
    particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.02;
        ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillRect(p.x - scrollX, p.y, p.size, p.size); ctx.globalAlpha = 1.0;
    });
    particles = particles.filter(p => p.life > 0);
    
    floatingTexts.forEach(ft => {
        ft.y -= 1; ft.life -= 0.015;
        ctx.fillStyle = ft.color; ctx.globalAlpha = Math.max(0, ft.life);
        ctx.font = "bold 16px Arial"; ctx.fillText(ft.text, ft.x - scrollX, ft.y); ctx.globalAlpha = 1.0;
    });
    floatingTexts = floatingTexts.filter(ft => ft.life > 0);
    
    ctx.restore(); 
    
    requestAnimationFrame(gameLoop);
}

game.init();
