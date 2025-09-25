// Galaxy Attack Canvas Game
(function() {
	const canvas = document.getElementById('galaxy-canvas');
	const ctx = canvas.getContext('2d');
	const W = canvas.width;
	const H = canvas.height;

	// Sound system
	let audioContext = null;
	let soundEnabled = false; // Sound off by default
	const soundIconSize = 24;
	const soundIconX = W - 40;
	const soundIconY = 30;

	function initAudio() {
		if (!audioContext) {
			audioContext = new (window.AudioContext || window.webkitAudioContext)();
		}
		// Resume context if suspended (required for some browsers)
		if (audioContext.state === 'suspended') {
			audioContext.resume();
		}
	}

	function playLaserSound() {
		if (!audioContext || !soundEnabled) return;

		const oscillator = audioContext.createOscillator();
		const gainNode = audioContext.createGain();

		oscillator.connect(gainNode);
		gainNode.connect(audioContext.destination);

		// Laser sound: quick frequency sweep from high to low
		oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
		oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);

		// Quick attack and decay
		gainNode.gain.setValueAtTime(0, audioContext.currentTime);
		gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
		gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);

		oscillator.type = 'sawtooth';
		oscillator.start(audioContext.currentTime);
		oscillator.stop(audioContext.currentTime + 0.1);
	}

	function playExplosionSound() {
		if (!audioContext || !soundEnabled) return;

		// Create noise for explosion effect
		const bufferSize = audioContext.sampleRate * 0.3; // 0.3 seconds
		const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
		const data = buffer.getChannelData(0);

		// Generate noise
		for (let i = 0; i < bufferSize; i++) {
			data[i] = (Math.random() - 0.5) * 2;
		}

		const noiseSource = audioContext.createBufferSource();
		noiseSource.buffer = buffer;

		// Filter for more explosive sound
		const filter = audioContext.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.setValueAtTime(1000, audioContext.currentTime);
		filter.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.3);

		const gainNode = audioContext.createGain();

		noiseSource.connect(filter);
		filter.connect(gainNode);
		gainNode.connect(audioContext.destination);

		// Explosion envelope: quick attack, slower decay
		gainNode.gain.setValueAtTime(0, audioContext.currentTime);
		gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.01);
		gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);

		noiseSource.start(audioContext.currentTime);
		noiseSource.stop(audioContext.currentTime + 0.3);
	}

	// Player ship
	const player = {
		x: W / 2,
		y: H - 60,
		w: 40,
		h: 40,
		speed: 6,
		color: '#0ff',
		cooldown: 0
	};

	// Cannon shots
	const shots = [];
	const shotSpeed = 10;
	const shotW = 6, shotH = 16;

	// Aliens
	const aliens = [];
	const alienW = 36, alienH = 36;
	const alienSpeedMin = 1.5, alienSpeedMax = 3.5;
	let alienSpawnTimer = 0;



	// Controls
	const keys = {};
	document.addEventListener('keydown', e => keys[e.code] = true);
	document.addEventListener('keyup', e => keys[e.code] = false);

	// Mouse control
	let mouseActive = false;
	let mouseX = null;
	canvas.addEventListener('mouseenter', e => { mouseActive = true; });
	canvas.addEventListener('mouseleave', e => { mouseActive = false; mouseX = null; });
	canvas.addEventListener('mousemove', e => {
		const rect = canvas.getBoundingClientRect();
		mouseX = e.clientX - rect.left;
	});

	// Auto-fire interval
	let fireInterval = null;
	function startAutoFire() {
		if (fireInterval) clearInterval(fireInterval);
		fireInterval = setInterval(() => {
			if (!gameOver) {
				shots.push({ x: player.x, y: player.y - player.h/2 });
				playLaserSound();
			}
		}, 500);
	}
	function stopAutoFire() {
		if (fireInterval) clearInterval(fireInterval);
		fireInterval = null;
	}

	// Score
	let score = 0;
	let gameOver = false;

	function drawSoundIcon() {
		ctx.save();
		ctx.translate(soundIconX, soundIconY);

		if (soundEnabled) {
			// Sound ON icon - speaker with sound waves
			// Speaker base
			ctx.beginPath();
			ctx.rect(-6, -4, 4, 8);
			ctx.fillStyle = '#0ff';
			ctx.fill();

			// Speaker cone
			ctx.beginPath();
			ctx.moveTo(-2, -6);
			ctx.lineTo(4, -10);
			ctx.lineTo(4, 10);
			ctx.lineTo(-2, 6);
			ctx.closePath();
			ctx.fillStyle = '#0ff';
			ctx.fill();

			// Sound waves
			ctx.strokeStyle = '#0ff';
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.arc(4, 0, 6, -Math.PI/3, Math.PI/3);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(4, 0, 10, -Math.PI/4, Math.PI/4);
			ctx.stroke();
		} else {
			// Sound OFF icon - speaker with X
			// Speaker base
			ctx.beginPath();
			ctx.rect(-6, -4, 4, 8);
			ctx.fillStyle = '#666';
			ctx.fill();

			// Speaker cone
			ctx.beginPath();
			ctx.moveTo(-2, -6);
			ctx.lineTo(4, -10);
			ctx.lineTo(4, 10);
			ctx.lineTo(-2, 6);
			ctx.closePath();
			ctx.fillStyle = '#666';
			ctx.fill();

			// X mark
			ctx.strokeStyle = '#f44';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(6, -6);
			ctx.lineTo(12, 6);
			ctx.moveTo(12, -6);
			ctx.lineTo(6, 6);
			ctx.stroke();
		}

		// Clickable area indicator (subtle border)
		ctx.strokeStyle = soundEnabled ? '#0ff' : '#666';
		ctx.lineWidth = 1;
		ctx.globalAlpha = 0.3;
		ctx.beginPath();
		ctx.rect(-soundIconSize/2, -soundIconSize/2, soundIconSize, soundIconSize);
		ctx.stroke();
		ctx.globalAlpha = 1;

		ctx.restore();
	}

	function drawPlayer() {
	ctx.save();
	ctx.translate(player.x, player.y);
	ctx.shadowColor = '#0ff';
	ctx.shadowBlur = 10;

	// Main body
	ctx.beginPath();
	ctx.moveTo(0, -player.h/2); // nose
	ctx.lineTo(-player.w/4, 0);
	ctx.lineTo(-player.w/2.5, player.h/2.5); // left body
	ctx.lineTo(0, player.h/3); // tail
	ctx.lineTo(player.w/2.5, player.h/2.5); // right body
	ctx.lineTo(player.w/4, 0);
	ctx.closePath();
	ctx.fillStyle = player.color;
	ctx.fill();

	// Cockpit
	ctx.beginPath();
	ctx.ellipse(0, -player.h/4, player.w/7, player.h/7, 0, 0, Math.PI*2);
	ctx.fillStyle = '#fff';
	ctx.globalAlpha = 0.7;
	ctx.fill();
	ctx.globalAlpha = 1;

	// Left wing
	ctx.beginPath();
	ctx.moveTo(-player.w/4, 0);
	ctx.lineTo(-player.w/1.7, player.h/2.5);
	ctx.lineTo(-player.w/2.5, player.h/2.5);
	ctx.lineTo(-player.w/4, 0);
	ctx.closePath();
	ctx.fillStyle = '#09f';
	ctx.fill();

	// Right wing
	ctx.beginPath();
	ctx.moveTo(player.w/4, 0);
	ctx.lineTo(player.w/1.7, player.h/2.5);
	ctx.lineTo(player.w/2.5, player.h/2.5);
	ctx.lineTo(player.w/4, 0);
	ctx.closePath();
	ctx.fillStyle = '#09f';
	ctx.fill();

	// Engine glow
	ctx.beginPath();
	ctx.ellipse(0, player.h/3 + 4, player.w/10, player.h/10, 0, 0, Math.PI*2);
	ctx.fillStyle = '#0ff';
	ctx.globalAlpha = 0.5;
	ctx.fill();
	ctx.globalAlpha = 1;

	ctx.restore();
	}

	function drawShot(shot) {
		ctx.save();
		ctx.translate(shot.x, shot.y);
		// Body
		ctx.beginPath();
		ctx.moveTo(0, -shotH/2);
		ctx.lineTo(-shotW/2, shotH/2);
		ctx.lineTo(shotW/2, shotH/2);
		ctx.closePath();
		ctx.fillStyle = '#ccc';
		ctx.fill();

		// Nose
		ctx.beginPath();
		ctx.moveTo(0, -shotH/2);
		ctx.lineTo(-shotW/4, -shotH/2 + 5);
		ctx.lineTo(shotW/4, -shotH/2 + 5);
		ctx.closePath();
		ctx.fillStyle = '#f44';
		ctx.fill();

		// Fins
		ctx.beginPath();
		ctx.moveTo(-shotW/2, shotH/2);
		ctx.lineTo(-shotW/2 - 2, shotH/2 + 5);
		ctx.lineTo(-shotW/4, shotH/2);
		ctx.closePath();
		ctx.fillStyle = '#09f';
		ctx.fill();
		ctx.beginPath();
		ctx.moveTo(shotW/2, shotH/2);
		ctx.lineTo(shotW/2 + 2, shotH/2 + 5);
		ctx.lineTo(shotW/4, shotH/2);
		ctx.closePath();
		ctx.fillStyle = '#09f';
		ctx.fill();

		// Flame
		ctx.beginPath();
		ctx.moveTo(0, shotH/2);
		ctx.lineTo(-2, shotH/2 + 7);
		ctx.lineTo(2, shotH/2 + 7);
		ctx.closePath();
		ctx.fillStyle = '#ff0';
		ctx.globalAlpha = 0.7;
		ctx.fill();
		ctx.globalAlpha = 1;

		ctx.restore();
	}

	function drawAlien(alien) {
		ctx.save();
		ctx.translate(alien.x, alien.y);
		ctx.shadowColor = '#f0f';
		ctx.shadowBlur = 10;


		// UFO disc base (symmetric, thin)
		ctx.beginPath();
		ctx.ellipse(0, 0, alienW/2, alienH/5.5, 0, 0, Math.PI*2);
		ctx.fillStyle = alien.color;
		ctx.fill();

		// UFO dome (top, symmetric)
		ctx.beginPath();
		ctx.ellipse(0, -alienH/10, alienW/3.2, alienH/11, 0, 0, Math.PI, true);
		ctx.fillStyle = '#fff';
		ctx.globalAlpha = 0.7;
		ctx.fill();
		ctx.globalAlpha = 1;

		// UFO rim (bottom, symmetric)
		ctx.beginPath();
		ctx.ellipse(0, alienH/14, alienW/2.2, alienH/18, 0, 0, Math.PI*2);
		ctx.fillStyle = '#aaa';
		ctx.globalAlpha = 0.5;
		ctx.fill();
		ctx.globalAlpha = 1;


		// Three glowing fire-like lights at the bottom, symmetrically placed
		// 3 small illuminators on the hull (front edge of disc)
		const illumY = 0; // horizontal center
		const illumXOffset = alienW/4.2;
		const illumPositions = [
			{ x: -illumXOffset, y: illumY },
			{ x: 0,             y: illumY },
			{ x:  illumXOffset, y: illumY }
		];
		for (const pos of illumPositions) {
			ctx.save();
			ctx.beginPath();
			ctx.arc(pos.x, pos.y, 2, 0, Math.PI*2);
			ctx.fillStyle = '#ffe066';
			ctx.shadowColor = '#ffe066';
			ctx.shadowBlur = 6;
			ctx.globalAlpha = 0.85;
			ctx.fill();
			ctx.shadowBlur = 0;
			ctx.globalAlpha = 1;
			ctx.restore();
		}

		ctx.restore();

		ctx.restore();
	}

	function spawnAlien() {
		const x = Math.random() * (W - alienW) + alienW/2;
		const speed = alienSpeedMin + Math.random() * (alienSpeedMax - alienSpeedMin);
		const color = `hsl(${Math.floor(Math.random()*360)},80%,60%)`;
		aliens.push({ x, y: -alienH, w: alienW, h: alienH, speed, color });
	}

	function update() {
		if (gameOver) return;

		// Player movement
		if (mouseActive && mouseX !== null) {
			if (Math.abs(mouseX - player.x) > player.speed) {
				if (mouseX < player.x) player.x -= player.speed;
				else if (mouseX > player.x) player.x += player.speed;
			}
		} else {
			if (keys['ArrowLeft'] || keys['KeyA']) player.x -= player.speed;
			if (keys['ArrowRight'] || keys['KeyD']) player.x += player.speed;
		}
		player.x = Math.max(player.w/2, Math.min(W - player.w/2, player.x));

		// ...existing code... (auto-fire handled by interval)

		// Update shots
		for (let i = shots.length - 1; i >= 0; i--) {
			shots[i].y -= shotSpeed;
			if (shots[i].y < -shotH) shots.splice(i, 1);
		}

		// Spawn aliens
		alienSpawnTimer--;
		if (alienSpawnTimer <= 0) {
			spawnAlien();
			alienSpawnTimer = 30 + Math.random() * 40;
		}

		// Update aliens
		for (let i = aliens.length - 1; i >= 0; i--) {
			aliens[i].y += aliens[i].speed;
			if (aliens[i].y > H + alienH) aliens.splice(i, 1);
		}

		// Collisions: shots vs aliens (use both rocket and alien width for hitbox)
		const alienHitW = alienW, alienHitH = alienH * 0.35;
		for (let i = aliens.length - 1; i >= 0; i--) {
			for (let j = shots.length - 1; j >= 0; j--) {
				if (
					Math.abs(aliens[i].x - shots[j].x) < (alienHitW/2 + shotW/2) &&
					Math.abs(aliens[i].y - shots[j].y) < (alienHitH/2)
				) {
					aliens.splice(i, 1);
					shots.splice(j, 1);
					score += 10;
					playExplosionSound();
					break;
				}
			}
		}

		// Collisions: aliens vs player (independent, with its own hitbox)
		const playerHitW = player.w * 0.7, playerHitH = player.h * 0.5;
		const alienPlayerHitW = alienW * 0.7, alienPlayerHitH = alienH * 0.45;
		for (let i = 0; i < aliens.length; i++) {
			if (Math.abs(aliens[i].x - player.x) < (alienPlayerHitW/2 + playerHitW/2) && Math.abs(aliens[i].y - player.y) < (alienPlayerHitH/2 + playerHitH/2)) {
				gameOver = true;
			}
		}
	}

	function draw() {
		ctx.clearRect(0, 0, W, H);
		// Background stars
		ctx.save();
		ctx.globalAlpha = 0.2;
		for (let i = 0; i < 80; i++) {
			ctx.beginPath();
			ctx.arc(Math.random()*W, Math.random()*H, Math.random()*1.5+0.5, 0, Math.PI*2);
			ctx.fillStyle = '#fff';
			ctx.fill();
		}
		ctx.restore();

		drawPlayer();
		shots.forEach(drawShot);
		aliens.forEach(drawAlien);

		// Score
		ctx.save();
		ctx.fillStyle = '#fff';
		ctx.font = '20px monospace';
		ctx.fillText('Score: ' + score, 16, 32);
		ctx.restore();

		// Sound icon
		drawSoundIcon();

		if (gameOver) {
			ctx.save();
			ctx.fillStyle = '#f44';
			ctx.font = 'bold 40px monospace';
			ctx.textAlign = 'center';
			ctx.fillText('GAME OVER', W/2, H/2 - 20);
			ctx.font = '24px monospace';
			ctx.fillStyle = '#fff';
			ctx.fillText('Score: ' + score, W/2, H/2 + 20);
			ctx.restore();
		}
	}

	function loop() {
		update();
		draw();
		requestAnimationFrame(loop);
	}


	function restartGame() {
		aliens.length = 0;
		shots.length = 0;
		player.x = W/2;
		player.y = H-60;
		player.cooldown = 0;
		score = 0;
		gameOver = false;
		startAutoFire();
	}

	document.addEventListener('keydown', function(e) {
		initAudio(); // Initialize audio on user interaction
		if (gameOver) {
			restartGame();
		}
	});
	canvas.addEventListener('mousedown', function(e) {
		const rect = canvas.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const clickY = e.clientY - rect.top;

		// Check if click is on sound icon
		if (Math.abs(clickX - soundIconX) <= soundIconSize/2 && 
		    Math.abs(clickY - soundIconY) <= soundIconSize/2) {
			initAudio(); // Initialize audio context if needed
			soundEnabled = !soundEnabled;
			return; // Don't restart game if clicking sound icon
		}

		initAudio(); // Initialize audio on user interaction
		if (gameOver) {
			restartGame();
		}
	});

	// Initialize audio on any user interaction
	canvas.addEventListener('click', initAudio);
	document.addEventListener('keypress', initAudio);

	// Start game
	startAutoFire();
	loop();
})();
