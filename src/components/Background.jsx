import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Background() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#2a1220');
        scene.fog = new THREE.FogExp2('#2a1220', 0.04);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.set(0, 0, 10);

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const galaxyGroup = new THREE.Group();
        scene.add(galaxyGroup);

        const colorsArray = [new THREE.Color('#ff1f4b'), new THREE.Color('#ff4d4d'), new THREE.Color('#fff2d6')];
        const stars = [];
        const numStars = 130;
        const starGeo = new THREE.SphereGeometry(0.03, 8, 8);
        const boundary = 12;

        for (let i = 0; i < numStars; i++) {
            const baseColor = colorsArray[Math.floor(Math.random() * colorsArray.length)];
            const star = new THREE.Mesh(starGeo, new THREE.MeshBasicMaterial({ color: baseColor }));
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
                color: baseColor,
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
        const linesMesh = new THREE.LineSegments(
            lineGeo,
            new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.75 })
        );
        galaxyGroup.add(linesMesh);

        const maxDistance = 3.5;
        let scrollPercent = 0;
        const onScroll = () => {
            const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
            const maxScroll = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            scrollPercent = maxScroll > 0 ? scrollTop / maxScroll : 0;
        };
        document.addEventListener('scroll', onScroll);

        const clock = new THREE.Clock();
        let frameId;
        function animate() {
            frameId = requestAnimationFrame(animate);
            const time = clock.getElapsedTime();
            galaxyGroup.rotation.y = time * 0.02 + scrollPercent * 1.5;
            galaxyGroup.rotation.x = scrollPercent * 0.5;
            camera.position.z = 10 - scrollPercent * 4;

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
                        const alpha = 1.0 - dist / maxDistance;
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

        const onResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', onResize);

        return () => {
            cancelAnimationFrame(frameId);
            document.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onResize);
            renderer.dispose();
        };
    }, []);

    return <canvas ref={canvasRef} id="webgl-canvas" />;
}
