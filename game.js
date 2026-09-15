const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statsUI = document.getElementById('playerStats');
const levelUI = document.getElementById('levelInfo');
const msgUI = document.getElementById('msg-box');
const lvlupUI = document.getElementById('lvlup-overlay');
const shopUI = document.getElementById('shop-overlay');
const shopGold = document.getElementById('shop-gold');
const shopTrash = document.getElementById('shop-trash');

// INPUT STATE
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('keypress', e => {
    if(e.code === 'KeyQ' || e.key === 'q') player.swapWeapon();
    if(e.code === 'Space') player.attack();
    if(e.code === 'KeyE' || e.key === 'e') game.interact();
    if(e.code === 'KeyH' || e.key === 'h') player.usePotion('hp');
    if(e.code === 'KeyJ' || e.key === 'j') player.usePotion('buff');
    
    if(player.statPoints > 0) {
        if(e.code === 'Digit1') player.addStat('STR');
        if(e.code === 'Digit2') player.addStat('INT');
        if(e.code === 'Digit3') player.addStat('AGI');
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

// MAP DATA
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

// DATABASE SENJATA (Dengan Sistem Rarity/Tier)
const weaponsDB = [
    { id: 0, name: "Ranting Kayu", tier: "Common", type: "melee", dmg: 3, range: 40, strScale: 0.5, intScale: 0, color: "#8B4513", tColor: "#bdc3c7" },
    { id: 1, name: "Pedang Ksatria", tier: "Uncommon", type: "melee", dmg: 10, range: 60, strScale: 1.5, intScale: 0, color: "#bdc3c7", tColor: "#2ecc71" },
    { id: 2, name: "Tongkat Sihir", tier: "Uncommon", type: "ranged", dmg: 5, range: 350, strScale: 0, intScale: 2.0, color: "#9b59b6", tColor: "#2ecc71" },
    { id: 3, name: "Belati Cepat", tier: "Uncommon", type: "melee", dmg: 6, range: 35, strScale: 1.2, intScale: 0.5, color: "#7f8c8d", tColor: "#2ecc71" },
    { id: 4, name: "Tombak Prajurit", tier: "Rare", type: "melee", dmg: 15, range: 100, strScale: 2.2, intScale: 0, color: "#3498db", tColor: "#3498db" },
    { id: 5, name: "Buku Es", tier: "Rare", type: "ranged", dmg: 12, range: 400, strScale: 0, intScale: 2.8, color: "#00ced1", tColor: "#3498db" },
    { id: 6, name: "Kapak Berat", tier: "Rare", type: "melee", dmg: 25, range: 50, strScale: 3.0, intScale: 0, color: "#2c3e50", tColor: "#3498db" },
    { id: 101, name: "Lendir Mematikan", tier: "Legendary", type: "melee", dmg: 18, range: 80, strScale: 1.5, intScale: 1.5, color: "#2ecc71", tColor: "#f1c40f" }, 
    { id: 102, name: "Tangan Golem", tier: "Legendary", type: "melee", dmg: 40, range: 60, strScale: 4.0, intScale: 0, color: "#7f8c8d", tColor: "#f1c40f" }, 
    { id: 103, name: "Kusarigama", tier: "Legendary", type: "ranged", dmg: 25, range: 250, strScale: 2.5, intScale: 1.0, color: "#2c3e50", tColor: "#f1c40f" }, 
    { id: 104, name: "Tongkat Tengkorak", tier: "Legendary", type: "ranged", dmg: 35, range: 500, strScale: 0, intScale: 4.5, color: "#c0392b", tColor: "#f1c40f" }, 
    { id: 105, name: "Napas Naga Hitam", tier: "Mythic", type: "ranged", dmg: 80, range: 800, strScale: 3.0, intScale: 6.0, color: "#1abc9c", tColor: "#e74c3c" }
];

// ITEM DROP (Senjata, Gold, Potion, Trash)
class ItemDrop {
    constructor(x, y, value, type='weapon') {
        this.x=x; this.y=y; this.w=15; this.h=15; 
        this.value = value; this.type = type; 
        this.vy = -3; this.vx = (Math.random()-0.5)*4;
        
        if(this.type === 'weapon') this.wp = weaponsDB.find(w => w.id === value);
    }
    update() {
        this.vy += GRAVITY; this.y += this.vy; this.x += this.vx;
        platforms.forEach(p => { 
            if(checkCol(this, p) && this.vy>0) { this.y=p.y-this.h; this.vy=0; this.vx=0; }
        });
        
        if(checkCol(this, player)) {
            if(this.type === 'weapon') {
                if (!player.weapons.includes(this.value)) {
                    player.weapons.push(this.value);
                    msg(`DAPAT SENJATA BARU: [${this.wp.tier}] ${this.wp.name}! Tekan Q untuk Equip.`, 5000);
                } else {
                    msg(`Anda sudah memiliki ${this.wp.name}.`, 3000);
                }
            } else if (this.type === 'gold') {
                player.gold += this.value;
                msg(`+${this.value} Gold`);
            } else if (this.type === 'item') {
                if(this.value === 'hp') { player.inv.hpPotion++; msg("Dapat HP Potion!"); }
                if(this.value === 'buff') { player.inv.buffPotion++; msg("Dapat Buff Potion!"); }
                if(this.value === 'trash') { player.inv.trash++; msg("Dapat Loot Biasa (Bisa dijual)"); }
            }
            player.updateUI();
            this.active = false;
        }
    }
    draw() {
        let px = this.x - scrollX;
        if(this.type === 'weapon') {
            ctx.fillStyle = this.wp.color; ctx.fillRect(px, this.y, this.w, this.h);
            ctx.fillStyle = this.wp.tColor; ctx.font="bold 10px Arial"; ctx.fillText(this.wp.tier, px-10, this.y-5);
        } else if(this.type === 'gold') {
            ctx.fillStyle = "#f1c40f"; ctx.beginPath(); ctx.arc(px+7, this.y+7, 6, 0, Math.PI*2); ctx.fill();
        } else if(this.type === 'item') {
            ctx.fillStyle = this.value === 'hp' ? "#e74c3c" : (this.value === 'buff' ? "#3498db" : "#bdc3c7");
            ctx.fillRect(px, this.y, 10, 15);
        }
    }
}

// PLAYER
class Player {
    constructor() {
        this.w = 26; this.h = 36;
        this.spawn(100, 300);
        
        this.lvl = 1; this.xp = 0; this.maxXp = 50;
        this.hp = 50; this.maxHp = 50; 
        this.str = 5; this.int = 5; this.agi = 0;
        this.statPoints = 0;
        
        // Inventory & Economy
        this.gold = 0;
        this.inv = { hpPotion: 2, buffPotion: 0, trash: 0 };
        this.buffTimer = 0;
        
        this.weapons = [0];
        this.weaponIdx = 0; 
        this.cd = 0;
    }
    
    get currentSpeed() { return (this.buffTimer > 0 ? 1.5 : 1.0) * (2.5 + (this.agi * 0.2)); }
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
        msg(`Ganti Senjata: [${this.weapon.tier}] ${this.weapon.name}`);
    }
    
    getDmg() { 
        let base = Math.floor(this.weapon.dmg + this.str*this.weapon.strScale + this.int*this.weapon.intScale);
        return this.buffTimer > 0 ? base * 2 : base;
    }
    
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
        }
        this.updateUI();
    }
    
    addStat(type) {
        if(this.statPoints <= 0) return;
        if(type === 'STR') this.str += 5;
        if(type === 'INT') this.int += 5;
        if(type === 'AGI') this.agi += 2;
        this.statPoints--;
        if(this.statPoints <= 0) lvlupUI.style.display = 'none';
        this.updateUI();
    }
    
    usePotion(type) {
        if(type === 'hp' && this.inv.hpPotion > 0) {
            this.inv.hpPotion--;
            this.hp = Math.min(this.maxHp, this.hp + 50);
            addParticle(this.x+10, this.y+10, "#2ecc71", 20);
            msg("Menggunakan Potion HP! (+50 HP)");
        } else if(type === 'buff' && this.inv.buffPotion > 0) {
            this.inv.buffPotion--;
            this.buffTimer = 600; 
            addParticle(this.x+10, this.y+10, "#3498db", 20);
            msg("Buff Aktif! (DMG & SPD x2 selama 10 detik)");
        }
        this.updateUI();
    }
    
    updateUI() {
        let xpPct = Math.min(100, (this.xp / this.maxXp) * 100);
        statsUI.innerHTML = `
        <b>LVL: ${this.lvl}</b> <div class="xp-bar-bg"><div class="xp-bar-fill" style="width:${xpPct}%"></div></div>
        <span style="color:#2ecc71"><b>HP:</b> ${this.hp}/${this.maxHp}</span> | 
        <span style="color:#e74c3c"><b>STR:</b> ${this.str}</span> | <span style="color:#3498db"><b>INT:</b> ${this.int}</span> | <span style="color:#f1c40f"><b>AGI:</b> ${this.agi}</span><br>
        <b>Senjata:</b> <span style="color:${this.weapon.tColor}">[${this.weapon.tier}] ${this.weapon.name}</span> (DMG: ${this.getDmg()})<br>
        <span style="color:#f1c40f">💰 ${this.gold} Gold</span> | 📦 <span style="color:#e74c3c">[H] Heal: ${this.inv.hpPotion}</span> | <span style="color:#3498db">[J] Buff: ${this.inv.buffPotion}</span>`;
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
        this.hp -= amt; addText(this.x, this.y-20, `-${amt}`, "#e74c3c");
        if(this.hp <= 0) {
            // DEATH PENALTY
            let lostXp = Math.floor(this.xp * 0.3);
            this.xp -= lostXp;
            msg(`ANDA MATI! Kehilangan ${lostXp} EXP. Kembali ke Lobby...`, 4000);
            this.hp = this.maxHp; 
            setTimeout(() => game.loadLevel(0), 3000);
        }
        this.updateUI();
    }
    
    update() {
        if(lvlupUI.style.display === 'flex') return;
        
        if(this.buffTimer > 0) {
            this.buffTimer--;
            if(this.buffTimer % 10 === 0) addParticle(this.x+10, this.y+10, "#3498db", 1, 1);
            if(this.buffTimer === 0) { msg("Efek Buff Habis!"); this.updateUI(); }
        }
        
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
        ctx.fillStyle = this.buffTimer > 0 ? "#8e44ad" : "#3498db"; 
        ctx.fillRect(px, this.y, this.w, this.h);
        ctx.fillStyle = "white"; ctx.fillRect(px + (this.dir===1?16:4), this.y+6, 6, 6);
        ctx.fillStyle = this.weapon.color;
        if(this.weapon.type === 'melee') ctx.fillRect(px + (this.dir===1?15:-5), this.y+15, 20, 4);
        else ctx.fillRect(px + (this.dir===1?15:-15), this.y+12, 30, 4);
    }
}

// PROYEKTIL
class Proj {
    constructor(x,y,vx,dmg,rng,col,isPlayer) {
        this.x=x; this.y=y; this.vx=vx; this.dmg=dmg; this.rng=rng; this.startX=x; 
        this.col=col; this.isPlayer=isPlayer; this.w=10; this.h=10; this.active=true;
    }
    update() {
        this.x += this.vx;
        if(Math.abs(this.x-this.startX) > this.rng) this.active = false;
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

// ENEMY & BOSS
class Enemy {
    constructor(x, y, type, isBoss=false, minX=null, maxX=null) {
        this.x=x; this.y=y; this.startX=x; this.startY=y; this.type=type; this.isBoss=isBoss;
        this.hp=30; this.maxHp=30; this.vx=-1; this.vy=0; 
        this.w=26; this.h=36; this.col="#e74c3c";
        this.atkCd = 0; this.xpDrop = 20;
        this.minX = minX !== null ? minX : x - 150;
        this.maxX = maxX !== null ? maxX : x + 150;
        this.setupType();
    }
    
    setupType() {
        if(this.type === 'goblin') { this.col="#2ecc71"; this.w=26; this.h=30; this.hp=30; }
        if(this.type === 'bat') { this.col="#8e44ad"; this.w=20; this.h=20; this.hp=20; this.xpDrop=30; }
        
        if(this.isBoss) {
            this.w=70; this.h=70; this.maxHp=300; this.hp=300; this.xpDrop=200;
            if(this.type === 'SlimeKing') { this.col = "rgba(46, 204, 113, 0.8)"; }
            if(this.type === 'Golem') { this.col = "#7f8c8d"; this.maxHp=500; this.hp=500; }
            if(this.type === 'Assassin') { this.col = "#2c3e50"; this.w=35; this.h=65; this.maxHp=400; this.hp=400; }
            if(this.type === 'Warlock') { this.col = "#c0392b"; this.w=40; this.h=65; }
            if(this.type === 'DarkDragon') { this.col = "#1abc9c"; this.w=100; this.h=90; this.maxHp=800; this.hp=800; this.xpDrop=500; }
        }
    }
    
    takeDmg(amt) {
        this.hp -= amt; addText(this.x+this.w/2, this.y, amt, "#fff");
        this.x += (player.x < this.x) ? 5 : -5;
        if(this.hp <= 0) {
            addParticle(this.x+this.w/2, this.y+this.h/2, this.col, 30, 4);
            player.gainXp(this.xpDrop);
            
            if(this.isBoss) {
                let bossDrops = { 'SlimeKing': 101, 'Golem': 102, 'Assassin': 103, 'Warlock': 104, 'DarkDragon': 105 };
                items.push(new ItemDrop(this.x + this.w/2, this.y + this.h - 20, bossDrops[this.type], 'weapon'));
                msg(`🔥 BOSS KALAH! LOOT SENJATA SPESIAL SEBELUM KEMBALI KE LOBBY! 🔥`, 8000);
                setTimeout(() => game.loadLevel(0), 8000); 
            } else {
                // MINION DROP LOGIC
                let roll = Math.random();
                if(roll < 0.05) {
                    let dropTier = Math.random() < 0.8 ? "Uncommon" : "Rare";
                    let pool = weaponsDB.filter(w => w.tier === dropTier);
                    if(pool.length > 0) {
                        let chosen = pool[Math.floor(Math.random() * pool.length)];
                        items.push(new ItemDrop(this.x, this.y, chosen.id, 'weapon'));
                    }
                } else if(roll < 0.15) {
                    items.push(new ItemDrop(this.x, this.y, 'hp', 'item'));
                } else if(roll < 0.20) {
                    items.push(new ItemDrop(this.x, this.y, 'buff', 'item'));
                } else if(roll < 0.35) {
                    items.push(new ItemDrop(this.x, this.y, 'trash', 'item'));
                }
                
                // Drop Gold Always
                items.push(new ItemDrop(this.x + 10, this.y, 5 + Math.floor(Math.random()*10), 'gold'));
            }
        }
    }
    
    update() {
        if(this.hp <= 0) return;
        
        if(!this.isBoss) {
            this.x += this.vx;
            if(this.type === 'bat') this.y = this.startY + Math.sin(Date.now()/300)*40;
            
            if(this.x <= this.minX) { this.x = this.minX; this.vx = Math.abs(this.vx); }
            else if(this.x + this.w >= this.maxX) { this.x = this.maxX - this.w; this.vx = -Math.abs(this.vx); }
        } else {
            this.atkCd--;
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
            if(this.type === 'DarkDragon') {
                this.y = 100 + Math.sin(Date.now()/600)*50;
                this.x += (player.x + 250 - this.x) * 0.01; 
                if(this.atkCd <= 0) { projectiles.push(new Proj(this.x, this.y+this.h, -10, 30, 1000, "#2ecc71", false)); this.atkCd = 50; }
            }
        }
        
        if(checkCol(this, player) && this.hp > 0) {
            player.takeDmg(this.isBoss ? 15 : 5);
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

// PORTAL / NPC
class Portal {
    constructor(x, y, targetLvl, text, color="#2980b9") { 
        this.x=x; this.y=y; this.w=60; this.h=80; this.target=targetLvl; this.text=text; this.color=color;
    }
    draw() {
        let px = this.x - scrollX;
        ctx.fillStyle = this.color; ctx.globalAlpha = 0.5; ctx.fillRect(px, this.y, this.w, this.h);
        ctx.globalAlpha = 1.0; ctx.fillRect(px+5, this.y+5, this.w-10, this.h-10);
        ctx.fillStyle = "white"; ctx.font="bold 14px Arial"; ctx.fillText(this.text, px-10, this.y-15);
    }
}

// MAP GENERATOR 
function generateLevel(cfg) {
    let plats = []; let enems = []; let itms = []; let decos = [];
    
    plats.push({x: -500, y: 450, w: 1000, h: 200, c1: cfg.pCol[0], c2: cfg.pCol[1]}); 
    
    let curX = 500;
    let lastY = 450;
    
    while(curX < cfg.len) {
        let type = Math.random();
        
        let pGap = 0.25; let pPlat = 0.6;
        if(cfg.id === 2) { pGap = 0.1; pPlat = 0.8; } 
        if(cfg.id === 3) { pGap = 0.4; pPlat = 0.5; } 
        if(cfg.id === 4) { pGap = 0.1; pPlat = 0.9; } 
        
        if(Math.random() < 0.3) decos.push({x: curX + Math.random()*200, y: (cfg.id===2 ? 0 : 300), type: cfg.id});
        
        if(type < pGap) {
            let gap = 30 + Math.random()*30; 
            curX += gap;
            
            plats.push({x: curX, y: 450, w: 300, h: 200, c1: cfg.pCol[0], c2: cfg.pCol[1]});
            if(Math.random() < 0.5) enems.push(new Enemy(curX + 150, 410, cfg.mob, false, curX, curX + 300));
            curX += 300; lastY = 450;
        } 
        else if(type < pPlat) {
            let diffY = (Math.random() * 100) - 50; 
            let h = lastY + diffY;
            if(h > 450) h = 450; 
            if(h < 200) h = 200; 
            
            let w = (cfg.id === 5) ? (100 + Math.random()*50) : (150 + Math.random()*100); 
            plats.push({x: curX, y: h, w: w, h: (cfg.id===4 ? 100:20), c1: cfg.pCol[0], c2: cfg.pCol[1]});
            if(Math.random() < 0.5) enems.push(new Enemy(curX + 20, h-40, cfg.mob, false, curX, curX + w));
            
            curX += w + (20 + Math.random()*30); 
            lastY = h;
        } 
        else {
            let h = 450;
            let w = 300 + Math.random()*200;
            plats.push({x: curX, y: h, w: w, h: 200, c1: cfg.pCol[0], c2: cfg.pCol[1]});
            if(Math.random() < 0.7) enems.push(new Enemy(curX + 150, h-40, cfg.mob, false, curX, curX + w));
            curX += w + (10 + Math.random()*20); 
            lastY = h;
        }
    }
    
    plats.push({x: cfg.len, y: 450, w: 1500, h: 200, c1: cfg.pCol[0], c2: cfg.pCol[1]});
    return { platforms: plats, enemies: enems, items: itms, decos: decos, bossX: cfg.len + 400, bossType: cfg.type, bg: cfg.bg };
}

// GAME STATE
const game = {
    level: 0,
    bossState: 'none',
    bossTimer: 0,
    
    init() { player.updateUI(); this.loadLevel(0); gameLoop(); },
    
    buyItem(item, price) {
        if(player.gold >= price) {
            player.gold -= price;
            if(item === 'hp') player.inv.hpPotion++;
            if(item === 'buff') player.inv.buffPotion++;
            msg("Pembelian sukses!");
            player.updateUI();
            shopGold.innerText = player.gold;
        } else {
            msg("Gold tidak cukup!");
        }
    },
    
    sellTrash() {
        let count = player.inv.trash;
        if(count > 0) {
            let earnings = count * 15; 
            player.gold += earnings;
            player.inv.trash = 0;
            msg(`Menjual ${count} loot seharga ${earnings} Gold!`);
            player.updateUI();
            shopGold.innerText = player.gold;
            shopTrash.innerText = 0;
        } else {
            msg("Tidak ada loot yang bisa dijual.");
        }
    },
    
    loadLevel(lvlId) {
        this.level = lvlId;
        platforms = []; enemies = []; portals = []; projectiles = []; particles = []; items = []; floatingTexts = [];
        player.spawn(100, 300);
        
        if(lvlId === 0) {
            levelUI.innerHTML = "🏛️ <b>LOBBY</b>";
            platforms.push({x:-1000, y:450, w:3000, h:200, c1:"#95a5a6", c2:"#7f8c8d"});
            
            portals.push(new Portal(100, 370, 'shop', "🛒 TOKO", "#e67e22")); // NPC Toko
            
            portals.push(new Portal(400, 370, 1, "Lv 1: Hutan Slime"));
            portals.push(new Portal(700, 370, 2, "Lv 2: Goa Golem"));
            portals.push(new Portal(1000,370, 3, "Lv 3: Markas Assassin"));
            portals.push(new Portal(1300,370, 4, "Lv 4: Menara Warlock"));
            portals.push(new Portal(1600,370, 5, "Lv 5: Sarang Naga"));
            currentMapData = { bg: ["#1a1a2e", "#1a1a2e"], bossX: 2000, decos: [] };
            this.bossState = 'none';
        }
        else {
            let config = {
                1: { id: 1, title: "🌲 LEVEL 1: Hutan Kematian", type: 'SlimeKing', len: 3000, mob: 'goblin', bg: ["#1a2a1a", "#2a0a0a"], pCol: ["#27ae60", "#2c3e50"] },
                2: { id: 2, title: "⛰️ LEVEL 2: Goa Golem", type: 'Golem', len: 4000, mob: 'bat', bg: ["#2c3e50", "#111111"], pCol: ["#7f8c8d", "#34495e"] },
                3: { id: 3, title: "⚔️ LEVEL 3: Markas Assassin", type: 'Assassin', len: 4500, mob: 'goblin', bg: ["#200000", "#400000"], pCol: ["#c0392b", "#8e44ad"] },
                4: { id: 4, title: "🔥 LEVEL 4: Menara Warlock", type: 'Warlock', len: 5000, mob: 'bat', bg: ["#301010", "#501010"], pCol: ["#d35400", "#c0392b"] },
                5: { id: 5, title: "🐉 LEVEL 5: Puncak Sarang Naga", type: 'DarkDragon', len: 6000, mob: 'bat', bg: ["#100020", "#300040"], pCol: ["#f1c40f", "#f39c12"] }
            };
            
            levelUI.innerHTML = config[lvlId].title;
            msg(`Memasuki ${config[lvlId].title}...`, 4000);
            currentMapData = generateLevel(config[lvlId]);
            platforms = currentMapData.platforms; enemies = currentMapData.enemies; items = currentMapData.items;
            this.bossState = 'waiting';
        }
    },
    
    interact() {
        portals.forEach(p => {
            if(checkCol({x:player.x, y:player.y, w:player.w, h:player.h}, p)) {
                if(p.target === 'shop') {
                    shopUI.style.display = 'flex';
                    shopGold.innerText = player.gold;
                    shopTrash.innerText = player.inv.trash;
                } else {
                    this.loadLevel(p.target);
                }
            }
        });
    }
};

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
    
    if(game.level > 0 && game.bossState === 'waiting') {
        let arenaStart = currentMapData.bossX - 500;
        if(player.x > arenaStart) {
            let minionsAlive = enemies.filter(e => !e.isBoss).length;
            if(minionsAlive > 0) {
                player.x = arenaStart;
                msg(`Kalahkan semua monster kecil sebelum Boss muncul! (${minionsAlive} tersisa)`, 100);
            } else {
                game.bossState = 'spawning';
                game.bossTimer = 180; 
            }
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
            msg("BOSS MUNCUL! BERSIAPLAH!", 3000);
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
