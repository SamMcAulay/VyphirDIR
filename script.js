import * as THREE from 'three';

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function setupAutoScroll(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let autoScrollInterval;
    const scrollStep = 155;
    const delay = 2500;

    const startScroll = () => {
        autoScrollInterval = setInterval(() => {
            if (Math.ceil(container.scrollLeft + container.clientWidth) >= container.scrollWidth) {
                container.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                container.scrollBy({ left: scrollStep, behavior: 'smooth' });
            }
        }, delay);
    };

    const stopScroll = () => clearInterval(autoScrollInterval);

    startScroll();

    container.addEventListener('mouseenter', stopScroll);
    container.addEventListener('mouseleave', startScroll);
    container.addEventListener('touchstart', stopScroll, {passive: true});
    container.addEventListener('touchend', startScroll, {passive: true});
}

const myCharacters = [
    { name: "Drasil", image: "https://f2.toyhou.se/file/f2-toyhou-se/images/114501788_An1zRhJpnT1KfDI.png" },
    { name: "Drasil", image: "https://f2.toyhou.se/file/f2-toyhou-se/images/115580905_NBL6YfKIzkd6XZI.jpg" },
    { name: "Vyphir", image: "https://f2.toyhou.se/file/f2-toyhou-se/images/115580781_Q1AtdHKUvzZnfRC.jpg" },
    { name: "Vyphir", image: "https://f2.toyhou.se/file/f2-toyhou-se/images/113510752_bjYmJ8bKHdr6Ymr.jpg" },
    { name: "Vyphir", image: "https://f2.toyhou.se/file/f2-toyhou-se/images/113510577_7Otz2pVtdW225fd.jpg" }, // <-- Added comma
    { name: "Vyphir", image: "https://f2.toyhou.se/file/f2-toyhou-se/images/113402414_W2iZGLPUB9Y9NAQ.png?1768418555" },
    { name: "Vyphir", image: "https://f2.toyhou.se/file/f2-toyhou-se/images/114501540_J92Mhjj5cc0RPh9.jpg" },
    { name: "Vyphir", image: "https://f2.toyhou.se/file/f2-toyhou-se/images/115580648_o0vhA1hFCYbU2d5.jpg" },
    { name: "Vyphir", image: "https://f2.toyhou.se/file/f2-toyhou-se/images/114805781_a40Nr5n6LCjNm3S.jpg" },
    { name: "Pharron", image: "https://f2.toyhou.se/file/f2-toyhou-se/images/113403545_8YAXWPf3EA5vZRu.jpg" }, // <-- Added comma
    { name: "Pharron", image: "https://f2.toyhou.se/file/f2-toyhou-se/images/113402669_PT7d8aSIIRblxrq.png" },
    { name: "Pharron", image: "https://f2.toyhou.se/file/f2-toyhou-se/images/114805937_aCPrL1MRKi29BOa.jpg" },
    { name: "Gritchin", image: "https://f2.toyhou.se/file/f2-toyhou-se/images/114500900_GcturMytU5GGcAh.jpg" },
    { name: "Gritchin", image: "https://f2.toyhou.se/file/f2-toyhou-se/images/114618012_i4sAdr9UVqf6grr.png?1770326788" },
    { name: "Gritchin", image: "https://f2.toyhou.se/file/f2-toyhou-se/images/115464806_AWcpQFMevag3IGY.jpg" }, // <-- Added comma
    { name: "Faeyren", image: "https://f2.toyhou.se/file/f2-toyhou-se/images/113511381_vDXA8mHCKs4aN0x.png" },
    { name: "Faeyren", image: "https://f2.toyhou.se/file/f2-toyhou-se/images/113511365_ueyxm4mrv97V0zj.jpg" },
    { name: "Faeyren", image: "https://f2.toyhou.se/file/f2-toyhou-se/images/113511334_1A5fiFw7HrEhSF8.png" }
];

shuffleArray(myCharacters);

const galleryDiv = document.getElementById('character-gallery');
if (galleryDiv) {
    myCharacters.forEach(char => {
        galleryDiv.innerHTML += `
            <div class="gallery-card">
                <img src="${char.image}" alt="${char.name}">
                <p>${char.name}</p>
            </div>
        `;
    });
    setupAutoScroll('character-gallery'); 
}

const bskyHandle = 'samisaderp.bsky.social'; 

async function loadBlueskyFeed() {
    const feedContainer = document.getElementById('bsky-feed');
    if (!feedContainer) return;

    try {
        const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${bskyHandle}&limit=3`);
        const data = await response.json();
        
        feedContainer.innerHTML = ''; 

        data.feed.forEach(item => {
            const post = item.post.record;
            const date = new Date(post.createdAt).toLocaleDateString();
            
            feedContainer.innerHTML += `
                <div style="border-bottom: 1px dashed rgba(255, 105, 180, 0.3); padding-bottom: 15px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color: var(--hot-pink); font-weight: bold; font-family: 'Space Mono', monospace; font-size: 0.8rem;">@${bskyHandle}</span>
                        <span style="color: var(--text-muted); font-size: 0.75rem; font-family: 'Space Mono', monospace;">${date}</span>
                    </div>
                    <p style="font-size: 0.9rem; line-height: 1.4;">${post.text}</p>
                </div>
            `;
        });
        
    } catch (error) {
        console.error(error);
        feedContainer.innerHTML = `<p style="color: var(--red); font-family: 'Space Mono', monospace;">> UPLINK FAILED.</p>`;
    }
}

loadBlueskyFeed();

const canvas = document.querySelector('#webgl-canvas');
const scene = new THREE.Scene();

scene.background = new THREE.Color('#120a0d'); 
scene.fog = new THREE.FogExp2('#120a0d', 0.04); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 10); 

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const galaxyGroup = new THREE.Group();
scene.add(galaxyGroup);

const colorPink = new THREE.Color('#ffb6c1');
const colorRed = new THREE.Color('#ff4d4d');
const colorWhite = new THREE.Color('#ffffff');
const colorsArray = [colorPink, colorRed, colorWhite];

const stars = [];
const numStars = 130; 
const starGeo = new THREE.SphereGeometry(0.03, 8, 8); 
const boundary = 12; 

for (let i = 0; i < numStars; i++) {
    const baseColor = colorsArray[Math.floor(Math.random() * colorsArray.length)];
    
    const starMat = new THREE.MeshBasicMaterial({ color: baseColor });
    const star = new THREE.Mesh(starGeo, starMat);
    
    star.position.set(
        (Math.random() - 0.5) * boundary * 2,
        (Math.random() - 0.5) * boundary * 2,
        (Math.random() - 0.5) * boundary * 2
    );
    
    star.userData = {
        velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.008, 
            (Math.random() - 0.5) * 0.008,
            (Math.random() - 0.5) * 0.008
        ),
        color: baseColor 
    };
    
    galaxyGroup.add(star);
    stars.push(star);
}

const maxConnections = (numStars * (numStars - 1)) / 2; 
const positions = new Float32Array(maxConnections * 6); 
const colors = new Float32Array(maxConnections * 6);    

const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
lineGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));

const lineMat = new THREE.LineBasicMaterial({ 
    vertexColors: true, 
    blending: THREE.AdditiveBlending, 
    transparent: true, 
    opacity: 0.6 
});

const linesMesh = new THREE.LineSegments(lineGeo, lineMat);
galaxyGroup.add(linesMesh);

const maxDistance = 3.5; 

let scrollPercent = 0;
document.addEventListener('scroll', () => {
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    const maxScroll = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    scrollPercent = maxScroll > 0 ? (scrollTop / maxScroll) : 0; 
});

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    galaxyGroup.rotation.y = time * 0.02 + (scrollPercent * 1.5);
    galaxyGroup.rotation.x = scrollPercent * 0.5;
    camera.position.z = 10 - (scrollPercent * 4); 

    let vertexPos = 0;
    let colorPos = 0;
    let numConnected = 0;

    for (let i = 0; i < numStars; i++) {
        const star = stars[i];
        star.position.add(star.userData.velocity);

        if (star.position.x < -boundary || star.position.x > boundary) star.userData.velocity.x *= -1;
        if (star.position.y < -boundary || star.position.y > boundary) star.userData.velocity.y *= -1;
        if (star.position.z < -boundary || star.position.z > boundary) star.userData.velocity.z *= -1;

        for (let j = i + 1; j < numStars; j++) {
            const otherStar = stars[j];
            const dist = star.position.distanceTo(otherStar.position);

            if (dist < maxDistance) {
                const alpha = 1.0 - (dist / maxDistance); 
                
                positions[vertexPos++] = star.position.x;
                positions[vertexPos++] = star.position.y;
                positions[vertexPos++] = star.position.z;
                
                positions[vertexPos++] = otherStar.position.x;
                positions[vertexPos++] = otherStar.position.y;
                positions[vertexPos++] = otherStar.position.z;

                colors[colorPos++] = star.userData.color.r * alpha; 
                colors[colorPos++] = star.userData.color.g * alpha; 
                colors[colorPos++] = star.userData.color.b * alpha; 

                colors[colorPos++] = otherStar.userData.color.r * alpha; 
                colors[colorPos++] = otherStar.userData.color.g * alpha; 
                colors[colorPos++] = otherStar.userData.color.b * alpha; 

                numConnected++;
            }
        }
    }

    lineGeo.setDrawRange(0, numConnected * 2);
    lineGeo.attributes.position.needsUpdate = true;
    lineGeo.attributes.color.needsUpdate = true;

    camera.position.y = Math.sin(time * 0.5) * 0.2;
    
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
