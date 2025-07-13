let clientCounter = 0;
let activeClients = [];
let ipPool = [];
let dnsCache = new Map();
let resolutionSteps = [];
let dhcpSteps = [];
let dragState = { isDragging: false, element: null, offsetX: 0, offsetY: 0 };

const domainDatabase = { 
    'google.com': '142.250.185.78',
    'github.com': '140.82.112.4',
    'stackoverflow.com': '151.101.129.69',
    'cloudflare.com': '104.16.132.229',
    'mozilla.org': '63.245.215.20',
    'wikipedia.org': '208.80.154.224',
    'amazon.com': '205.251.242.103',
    'microsoft.com': '20.112.52.29',
    'youtube.com': '172.217.15.110',
    'facebook.com': '157.240.241.35'
};

const explanations = {
    dns_query: "DNS Query: The client is asking 'What's the IP address for this website name?'",
    dns_cache_hit: "Cache Hit: DNS server already knows this answer - super fast response!",
    dns_cache_miss: "Cache Miss: DNS server needs to look this up by asking other servers",
    dns_root: "Root Query: Asking the internet's root servers 'Who handles .com domains?'",
    dns_tld: "TLD Query: Asking .com servers 'Who's responsible for this specific domain?'",
    dns_auth: "Authoritative Query: Asking the domain's official servers for the IP address",
    dns_response: "DNS Response: Sending back the IP address so the client can connect",
    dhcp_discover: "DHCP Discover: New device saying 'I need an IP address, anyone there?'",
    dhcp_offer: "DHCP Offer: Server saying 'I can give you this IP address if you want it'",
    dhcp_request: "DHCP Request: Device saying 'Yes, I accept that IP address, please confirm'",
    dhcp_ack: "DHCP Acknowledge: Server saying 'Confirmed! That IP is now yours to use'"
};

function initializeIPPool() {
    for (let i = 10; i <= 254; i++) {
        ipPool.push(`192.168.1.${i}`);
    }
}

function initializeDNSCache() {
    dnsCache.set('google.com', { ip: '142.250.185.78', ttl: 299, timestamp: Date.now() });
    dnsCache.set('github.com', { ip: '140.82.112.4', ttl: 245, timestamp: Date.now() });
    dnsCache.set('youtube.com', { ip: '172.217.15.110', ttl: 180, timestamp: Date.now() });
    updateDNSCacheDisplay();
}

function updateDNSCacheDisplay() {
    const container = document.getElementById('dns-cache-entries');
    container.innerHTML = '';
    
    dnsCache.forEach((value, domain) => {
        const timeLeft = Math.max(0, value.ttl - Math.floor((Date.now() - value.timestamp) / 1000));
        if (timeLeft > 0) {
            const entry = document.createElement('div');
            entry.className = 'cache-entry';
            entry.innerHTML = `
                <span>${domain} → ${value.ip}</span>
                <span class="cache-ttl">${timeLeft}s</span>
            `;
            container.appendChild(entry);
        }
    });

    if (container.children.length === 0) {
        container.innerHTML = '<div style="font-size: 10px; opacity: 0.7;">Cache is empty - try a DNS query!</div>';
    }
}

function log(message, explanation = '', type = 'info') {
    const logContainer = document.getElementById('activity-log');
    const entry = document.createElement('div');
    entry.className = `log-entry ${explanation ? 'explanation' : ''}`;
    entry.innerHTML = `
        <strong>${new Date().toLocaleTimeString()}</strong> - ${message}
        ${explanation ? `<br><small style="color: #64ffda;">${explanation}</small>` : ''}
    `;
    logContainer.insertBefore(entry, logContainer.firstChild);
    
    if (logContainer.children.length > 6) {
        logContainer.removeChild(logContainer.lastChild);
    }
}

function updateResolutionProcess(steps) {
    const container = document.getElementById('resolution-steps');
    container.innerHTML = '';
    
    if (steps.length === 0) {
        container.innerHTML = '<div style="font-size: 10px; opacity: 0.7;">Ready for DNS queries...</div>';
        return;
    }
    
    steps.forEach((step, index) => {
        const stepElement = document.createElement('div');
        stepElement.className = `resolution-step ${step.status}`;
        stepElement.innerHTML = `
            <strong>Step ${index + 1}:</strong> ${step.description}
            ${step.details ? `<br><small>${step.details}</small>` : ''}
            ${step.explanation ? `<br><small style="color: #64ffda;">${step.explanation}</small>` : ''}
        `;
        container.appendChild(stepElement);
    });
}

function updateDHCPProcess(steps) {
    const doraSteps = document.querySelectorAll('.dora-step');
    
    doraSteps.forEach(step => {
        step.className = 'dora-step';
    });
    
    steps.forEach((step, index) => {
        if (index < doraSteps.length) {
            if (step.status === 'active') {
                doraSteps[index].classList.add('active');
            } else if (step.status === 'completed') {
                doraSteps[index].classList.add('completed');
            }
        }
    });
}

function initializeDragAndDrop() {
    document.addEventListener('mousedown', (e) => {
        const draggable = e.target.closest('.draggable');
        if (!draggable) return;
        
        if (e.target.closest('.internal-component')) return;
        
        dragState.isDragging = true;
        dragState.element = draggable;
        
        const rect = draggable.getBoundingClientRect();
        const networkRect = document.getElementById('network-area').getBoundingClientRect();
        
        dragState.offsetX = e.clientX - rect.left;
        dragState.offsetY = e.clientY - rect.top;
        
        draggable.classList.add('dragging');
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!dragState.isDragging || !dragState.element) return;
        
        const networkArea = document.getElementById('network-area');
        const networkRect = networkArea.getBoundingClientRect();
        
        let x = e.clientX - networkRect.left - dragState.offsetX;
        let y = e.clientY - networkRect.top - dragState.offsetY;
        
        const elementRect = dragState.element.getBoundingClientRect();
        x = Math.max(0, Math.min(x, networkRect.width - elementRect.width));
        y = Math.max(0, Math.min(y, networkRect.height - elementRect.height));
        
        dragState.element.style.left = `${x}px`;
        dragState.element.style.top = `${y}px`;
        
        if (dragState.element.classList.contains('client')) {
            const clientData = activeClients.find(c => c.element === dragState.element);
            if (clientData) {
                clientData.x = x + elementRect.width / 2;
                clientData.y = y + elementRect.height / 2;
            }
        }
        
        createWires();
    });

    document.addEventListener('mouseup', () => {
        if (dragState.element) {
            dragState.element.classList.remove('dragging');
        }
        dragState.isDragging = false;
        dragState.element = null;
    });
}

function getInternalComponentCenter(componentId) {
    const component = document.getElementById(componentId);
    const router = document.getElementById('router');
    if (!component || !router) return null;
    
    const compRect = component.getBoundingClientRect();
    const routerRect = router.getBoundingClientRect();
    const networkRect = document.getElementById('network-area').getBoundingClientRect();
    
    return {
        x: compRect.left + compRect.width / 2 - networkRect.left,
        y: compRect.top + compRect.height / 2 - networkRect.top
    };
}

async function createInternalRouterPacket(start, end, type, label = '') {
    const packet = document.createElement('div');
    packet.className = `data-packet packet-${type}`;
    packet.title = label;
    packet.style.animation = 'packetPulse 0.6s ease-in-out infinite';
    packet.style.transform = 'scale(1.0)';
    
    const startX = start.x;
    const startY = start.y;
    const endX = end.x;
    const endY = end.y;
    
    packet.style.left = `${startX}px`;
    packet.style.top = `${startY}px`;
    packet.style.opacity = '1';
    
    document.getElementById('network-area').appendChild(packet);
    
    const duration = 2500;
    const startTime = Date.now();
    
    return new Promise((resolve) => {
        function animatePacket() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeProgress = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            const currentX = startX + (endX - startX) * easeProgress;
            const currentY = startY + (endY - startY) * easeProgress;
            
            packet.style.left = `${currentX}px`;
            packet.style.top = `${currentY}px`;
            packet.style.opacity = `${1 - progress * 0.05}`;
            
            if (progress < 1) {
                requestAnimationFrame(animatePacket);
            } else {
                packet.style.opacity = '0';
                setTimeout(() => {
                    if (packet.parentNode) {
                        packet.remove();
                    }
                    resolve();
                }, 200);
            }
        }
        
        requestAnimationFrame(animatePacket);
    });
}

function addClient() {
    if (activeClients.length >= 4) {
        log('Maximum clients reached (4)', 'Keeping the simulation simple for learning purposes');
        return;
    }

    clientCounter++;
    const clientId = `client-${clientCounter}`;
    const networkArea = document.getElementById('network-area');
    
    const client = document.createElement('div');
    client.className = 'client draggable';
    client.id = clientId;
    
    const positions = [
        { x: 200, y: 537 },
        { x: 750, y: 537 },
        { x: 400, y: 450 },
        { x: 300, y: 520 }
    ];
    
    const pos = positions[activeClients.length] || positions[0];
    
    client.style.left = `${pos.x}px`;
    client.style.top = `${pos.y}px`;
    
    client.innerHTML = `
        <svg class="client-icon" viewBox="0 0 24 24" fill="#64ffda">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <path d="M8 21l4-7 4 7" stroke="#64ffda" stroke-width="2" fill="none"/>
            <circle cx="12" cy="10" r="2" fill="white"/>
        </svg>
        <div class="client-label">Device ${clientCounter}<br><small>Needs IP</small></div>
    `;
    
    client.onclick = (e) => {
        if (!dragState.isDragging) {
            requestIP(clientId);
        }
    };
    
    networkArea.appendChild(client);
    
    const clientData = {
        id: clientId,
        name: `Device ${clientCounter}`,
        ip: null,
        element: client,
        x: pos.x + 50,
        y: pos.y + 50
    };
    
    activeClients.push(clientData);
    createWires();
    
    log(`${clientData.name} connected to network`, 'A new device joined and needs configuration to communicate');
}

function createWires() {
    document.querySelectorAll('.wire').forEach(wire => wire.remove());
    
    const internetEl = document.getElementById('internet-gateway');
    const routerEl = document.getElementById('router');
    const switchEl = document.getElementById('switch');
    
    const internetRect = internetEl.getBoundingClientRect();
    const routerRect = routerEl.getBoundingClientRect();
    const switchRect = switchEl.getBoundingClientRect();
    const networkRect = document.getElementById('network-area').getBoundingClientRect();
    
    const internetCenter = {
        x: internetRect.left + internetRect.width / 2 - networkRect.left,
        y: internetRect.top + internetRect.height / 2 - networkRect.top
    };
    
    const routerCenter = {
        x: routerRect.left + routerRect.width / 2 - networkRect.left,
        y: routerRect.top + routerRect.height / 2 - networkRect.top
    };
    
    const switchCenter = {
        x: switchRect.left + switchRect.width / 2 - networkRect.left,
        y: switchRect.top + switchRect.height / 2 - networkRect.top
    };
    
    createWire(internetCenter, routerCenter);
    
    createWire(routerCenter, switchCenter);
    
    activeClients.forEach(client => {
        createWire(switchCenter, { x: client.x, y: client.y });
    });

    createInternalRouterWires();
}

function createInternalRouterWires() {
    document.querySelectorAll('.internal-wire').forEach(wire => wire.remove());
    
    const router = document.getElementById('router');
    if (!router) return;
    
    const routerRect = router.getBoundingClientRect();
    const dns = document.getElementById('dns-component');
    const dhcp = document.getElementById('dhcp-component');
    const gateway = document.getElementById('gateway-component');
    const firewall = document.getElementById('firewall-component');
    
    if (!dns || !dhcp || !gateway || !firewall) return;
    
    const components = [
        { element: dns, center: getComponentCenter(dns, router) },
        { element: dhcp, center: getComponentCenter(dhcp, router) },
        { element: gateway, center: getComponentCenter(gateway, router) },
        { element: firewall, center: getComponentCenter(firewall, router) }
    ];
    
    for (let i = 0; i < components.length; i++) {
        for (let j = i + 1; j < components.length; j++) {
            createInternalWire(components[i].center, components[j].center, router);
        }
    }
}

function getComponentCenter(component, router) {
    const compRect = component.getBoundingClientRect();
    const routerRect = router.getBoundingClientRect();
    
    return {
        x: compRect.left + compRect.width / 2 - routerRect.left,
        y: compRect.top + compRect.height / 2 - routerRect.top
    };
}

function createInternalWire(start, end, router) {
    const wire = document.createElement('div');
    wire.className = 'internal-wire';
    
    const distance = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
    const angle = Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI);
    
    wire.style.width = `${distance}px`;
    wire.style.left = `${start.x}px`;
    wire.style.top = `${start.y}px`;
    wire.style.transform = `rotate(${angle}deg)`;
    wire.style.transformOrigin = '0 50%';
    
    router.appendChild(wire);
}

function createWire(start, end) {
    const wire = document.createElement('div');
    wire.className = 'wire';
    
    const distance = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
    const angle = Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI);
    
    wire.style.width = `${distance}px`;
    wire.style.left = `${start.x}px`;
    wire.style.top = `${start.y}px`;
    wire.style.transform = `rotate(${angle}deg)`;
    wire.style.transformOrigin = '0 50%';
    
    document.getElementById('network-area').appendChild(wire);
}

function createDataPacket(start, end, type, label = '') {
    return new Promise((resolve) => {
        const packet = document.createElement('div');
        packet.className = `data-packet packet-${type}`;
        packet.title = label;
        packet.style.animation = 'packetPulse 0.5s ease-in-out infinite';
        
        const startX = start.x;
        const startY = start.y;
        const endX = end.x;
        const endY = end.y;
        
        packet.style.left = `${startX}px`;
        packet.style.top = `${startY}px`;
        packet.style.opacity = '1';
        
        document.getElementById('network-area').appendChild(packet);
        
        const duration = 800;
        const startTime = Date.now();
        
        function animatePacket() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeProgress = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            const currentX = startX + (endX - startX) * easeProgress;
            const currentY = startY + (endY - startY) * easeProgress;
            
            packet.style.left = `${currentX}px`;
            packet.style.top = `${currentY}px`;
            packet.style.opacity = `${1 - progress * 0.3}`;
            
            if (progress < 1) {
                requestAnimationFrame(animatePacket);
            } else {
                packet.style.opacity = '0';
                setTimeout(() => {
                    if (packet.parentNode) {
                        packet.remove();
                    }
                    resolve();
                }, 100);
            }
        }
        
        requestAnimationFrame(animatePacket);
    });
}

function showActivity(deviceId, type) {
    const device = document.getElementById(deviceId);
    const indicator = document.createElement('div');
    indicator.className = `activity-indicator ${type}-indicator`;
    device.appendChild(indicator);
    
    setTimeout(() => indicator.remove(), 3000);
}

function getServerCenter(serverId) {
    let actualId = serverId;
    if (serverId === 'dns-server' || serverId === 'dhcp-server') {
        actualId = 'router';
    }
    
    const server = document.getElementById(actualId);
    const serverRect = server.getBoundingClientRect();
    const networkRect = document.getElementById('network-area').getBoundingClientRect();
    
    return {
        x: serverRect.left + serverRect.width / 2 - networkRect.left,
        y: serverRect.top + serverRect.height / 2 - networkRect.top
    };
}

async function performDNSQuery() {
    if (activeClients.length === 0) {
        log('No devices available', 'Add some network devices first to perform DNS queries');
        return;
    }
    
    const domain = document.getElementById('domain-input').value.trim() || 'google.com';
    const randomClient = activeClients[Math.floor(Math.random() * activeClients.length)];
    
    log(`${randomClient.name} wants to visit ${domain}`, explanations.dns_query);
    
    resolutionSteps = [
        { 
            description: `Received DNS query for ${domain}`, 
            status: 'active', 
            details: `From ${randomClient.name} (${randomClient.ip || 'no IP'})`,
            explanation: 'Client asks router: "What IP address should I use to connect to this website?"'
        }
    ];
    updateResolutionProcess(resolutionSteps);
    
    const switchCenter = getServerCenter('switch');
    const routerCenter = getServerCenter('router');
    const firewallCenter = getInternalComponentCenter('firewall-component');
    const dnsCenter = getInternalComponentCenter('dns-component');
    const gatewayCenter = getInternalComponentCenter('gateway-component');
    
    await createDataPacket({ x: randomClient.x, y: randomClient.y }, switchCenter, 'query', `DNS Query: ${domain}`);
    await createDataPacket(switchCenter, routerCenter, 'query', `DNS Query: ${domain}`);
    
    await createInternalRouterPacket(routerCenter, dnsCenter, 'query', 'DNS Query');
    showActivity('router', 'query');
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    resolutionSteps[0].status = 'completed';
    resolutionSteps.push({ 
        description: 'Checking router DNS cache', 
        status: 'active', 
        details: 'Looking for recently cached answer',
        explanation: 'First check: Does the router already know this answer from a recent lookup?'
    });
    updateResolutionProcess(resolutionSteps);
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const cached = dnsCache.get(domain);
    if (cached && (Date.now() - cached.timestamp) / 1000 < cached.ttl) {
        resolutionSteps[1].status = 'completed';
        resolutionSteps[1].details = `Cache HIT: ${domain} → ${cached.ip}`;
        resolutionSteps[1].explanation = 'Found it! Router can answer immediately without asking internet servers.';
        resolutionSteps.push({ 
            description: 'Returning cached result', 
            status: 'completed', 
            details: `IP: ${cached.ip}, TTL: ${cached.ttl}s`,
            explanation: 'Sending the IP address back to the client quickly!'
        });
        updateResolutionProcess(resolutionSteps);
        
        await createInternalRouterPacket(dnsCenter, routerCenter, 'response', 'DNS Response');
        
        await createDataPacket(routerCenter, switchCenter, 'response', `DNS Response: ${cached.ip}`);
        await createDataPacket(switchCenter, { x: randomClient.x, y: randomClient.y }, 'response', `DNS Response: ${cached.ip}`);
        
        log(`DNS resolved ${domain} → ${cached.ip} (from router cache)`, explanations.dns_cache_hit);
    } else {
        resolutionSteps[1].status = 'completed';
        resolutionSteps[1].details = 'Cache MISS - need internet lookup';
        resolutionSteps[1].explanation = 'Not in router cache, so router needs to ask the internet hierarchy of DNS servers.';
        resolutionSteps.push({ 
            description: 'Querying internet root nameservers', 
            status: 'active', 
            details: 'Router contacting . (root) servers',
            explanation: 'Step 1: Router asks root servers "Who handles .com domains?"'
        });
        updateResolutionProcess(resolutionSteps);
        
        const internetCenter = getServerCenter('internet-gateway');
        
        await createInternalRouterPacket(dnsCenter, gatewayCenter, 'query', 'Root Query');
        await createInternalRouterPacket(gatewayCenter, firewallCenter, 'query', 'Root Query (via Firewall)');
        await createDataPacket(routerCenter, internetCenter, 'query', 'Root Query');
        
        await new Promise(resolve => setTimeout(resolve, 800));
        
        await createDataPacket(internetCenter, routerCenter, 'response', 'Root Response');
        await createInternalRouterPacket(firewallCenter, gatewayCenter, 'response', 'Root Response (via Firewall)');
        await createInternalRouterPacket(gatewayCenter, dnsCenter, 'response', 'Root Response');
        
        resolutionSteps[2].status = 'completed';
        resolutionSteps[2].details = 'Root: "Ask .com TLD servers"';
        resolutionSteps[2].explanation = 'Root servers told router which servers handle .com domains.';
        
        const tld = domain.split('.').pop();
        resolutionSteps.push({ 
            description: `Querying .${tld} TLD servers`, 
            status: 'active', 
            details: `Router finding authoritative servers`,
            explanation: `Step 2: Router asks .${tld} servers "Who's responsible for ${domain}?"`
        });
        updateResolutionProcess(resolutionSteps);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await createInternalRouterPacket(dnsCenter, gatewayCenter, 'query', 'TLD Query');
        await createInternalRouterPacket(gatewayCenter, firewallCenter, 'query', 'TLD Query (via Firewall)');
        await createDataPacket(routerCenter, internetCenter, 'query', 'TLD Query');
        
        await new Promise(resolve => setTimeout(resolve, 800));
        
        await createDataPacket(internetCenter, routerCenter, 'response', 'TLD Response');
        await createInternalRouterPacket(firewallCenter, gatewayCenter, 'response', 'TLD Response (via Firewall)');
        await createInternalRouterPacket(gatewayCenter, dnsCenter, 'response', 'TLD Response');
        
        resolutionSteps[3].status = 'completed';
        resolutionSteps[3].details = `TLD: "Ask ${domain}'s servers"`;
        resolutionSteps[3].explanation = `TLD servers gave router the authoritative servers for ${domain}.`;
        resolutionSteps.push({ 
            description: 'Querying authoritative nameservers', 
            status: 'active', 
            details: `Router asking ${domain}'s official servers`,
            explanation: `Step 3: Router asks ${domain}'s own servers "What's your IP address?"`
        });
        updateResolutionProcess(resolutionSteps);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await createInternalRouterPacket(dnsCenter, gatewayCenter, 'query', 'Auth Query');
        await createInternalRouterPacket(gatewayCenter, firewallCenter, 'query', 'Auth Query (via Firewall)');
        await createDataPacket(routerCenter, internetCenter, 'query', 'Auth Query');
        
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const ip = domainDatabase[domain] || `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
        
        await createDataPacket(internetCenter, routerCenter, 'response', `Final Answer: ${ip}`);
        await createInternalRouterPacket(firewallCenter, gatewayCenter, 'response', `Final Answer: ${ip} (via Firewall)`);
        await createInternalRouterPacket(gatewayCenter, dnsCenter, 'response', `Final Answer: ${ip}`);
        
        resolutionSteps[4].status = 'completed';
        resolutionSteps[4].details = `Got IP: ${ip}`;
        resolutionSteps[4].explanation = `Success! The authoritative servers gave router the real IP address.`;
        resolutionSteps.push({ 
            description: 'Caching and responding', 
            status: 'completed', 
            details: `Router cached for 300s, sending to client`,
            explanation: 'Router saving this answer for next time, then telling the client!'
        });
        updateResolutionProcess(resolutionSteps);
        
        dnsCache.set(domain, { ip: ip, ttl: 300, timestamp: Date.now() });
        updateDNSCacheDisplay();
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await createInternalRouterPacket(dnsCenter, routerCenter, 'response', `Final: ${ip}`);
        await createDataPacket(routerCenter, switchCenter, 'response', `Final: ${ip}`);
        await createDataPacket(switchCenter, { x: randomClient.x, y: randomClient.y }, 'response', `Final: ${ip}`);
        
        log(`DNS resolved ${domain} → ${ip} (via internet lookup)`, explanations.dns_response);
    }
}

async function requestIP(clientId) {
    const client = activeClients.find(c => c.id === clientId);
    if (!client) return;
    
    if (client.ip) {
        log(`${client.name} already has IP: ${client.ip}`, 'This device already has a network address and can communicate');
        return;
    }
    
    if (ipPool.length === 0) {
        log('DHCP pool exhausted', 'No more IP addresses available - need to expand the pool or wait for leases to expire');
        return;
    }
    
    log(`${client.name} starting DHCP process`, explanations.dhcp_discover);
    
    dhcpSteps = [
        { 
            phase: 'DISCOVER', 
            description: 'Broadcasting discovery request', 
            status: 'active',
            details: 'Client: "I need an IP address, any DHCP servers listening?"',
            explanation: 'Step 1: Device broadcasts to find available DHCP servers'
        }
    ];
    updateDHCPProcess(dhcpSteps);
    
    const switchCenter = getServerCenter('switch');
    const routerCenter = getServerCenter('router');
    const dhcpCenter = getInternalComponentCenter('dhcp-component');
    
    await createDataPacket({ x: client.x, y: client.y }, switchCenter, 'discover', 'DHCP Discover');
    await createDataPacket(switchCenter, routerCenter, 'discover', 'DHCP Discover');
    await createInternalRouterPacket(routerCenter, dhcpCenter, 'discover', 'DHCP Discover');
    showActivity('router', 'dhcp');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    dhcpSteps[0].status = 'completed';
    dhcpSteps.push({
        phase: 'OFFER',
        description: 'Router offering IP address',
        status: 'active',
        details: `Router: "I can offer you ${ipPool[0]}"`,
        explanation: 'Step 2: Router DHCP service offers an available IP address'
    });
    updateDHCPProcess(dhcpSteps);
    
    await createInternalRouterPacket(dhcpCenter, routerCenter, 'offer', `DHCP Offer: ${ipPool[0]}`);
    await createDataPacket(routerCenter, switchCenter, 'offer', `DHCP Offer: ${ipPool[0]}`);
    await createDataPacket(switchCenter, { x: client.x, y: client.y }, 'offer', `DHCP Offer: ${ipPool[0]}`);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    dhcpSteps[1].status = 'completed';
    dhcpSteps.push({
        phase: 'REQUEST',
        description: 'Client requesting offered IP',
        status: 'active',
        details: `Client: "Yes, I want ${ipPool[0]}"`,
        explanation: 'Step 3: Client accepts the offer and formally requests the IP'
    });
    updateDHCPProcess(dhcpSteps);
    
    await createDataPacket({ x: client.x, y: client.y }, switchCenter, 'request', 'DHCP Request');
    await createDataPacket(switchCenter, routerCenter, 'request', 'DHCP Request');
    await createInternalRouterPacket(routerCenter, dhcpCenter, 'request', 'DHCP Request');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const assignedIP = ipPool.shift();
    client.ip = assignedIP;
    
    dhcpSteps[2].status = 'completed';
    dhcpSteps.push({
        phase: 'ACKNOWLEDGE',
        description: 'Router confirming assignment',
        status: 'completed',
        details: `Router: "Confirmed! ${assignedIP} is yours for 24 hours"`,
        explanation: 'Step 4: Router DHCP service confirms the assignment - device is now ready!'
    });
    updateDHCPProcess(dhcpSteps);
    
    const label = client.element.querySelector('.client-label');
    label.innerHTML = `${client.name}<br><small>${assignedIP}</small>`;
    
    await createInternalRouterPacket(dhcpCenter, routerCenter, 'ack', `DHCP ACK: ${assignedIP}`);
    await createDataPacket(routerCenter, switchCenter, 'ack', `DHCP ACK: ${assignedIP}`);
    await createDataPacket(switchCenter, { x: client.x, y: client.y }, 'ack', `DHCP ACK: ${assignedIP}`);
    
    log(`Router DHCP assigned ${assignedIP} to ${client.name}`, explanations.dhcp_ack);
}

function simulateDHCPRequest() {
    if (activeClients.length === 0) {
        log('No devices available', 'Add some network devices first to perform DHCP requests');
        return;
    }
    
    const unassignedClients = activeClients.filter(c => !c.ip);
    if (unassignedClients.length === 0) {
        log('All devices have IP addresses', 'All connected devices already have valid network addresses');
        return;
    }
    
    const randomClient = unassignedClients[Math.floor(Math.random() * unassignedClients.length)];
    requestIP(randomClient.id);
}

function clearDNSCache() {
    dnsCache.clear();
    updateDNSCacheDisplay();
    resolutionSteps = [];
    updateResolutionProcess(resolutionSteps);
    log('DNS cache cleared', 'All cached domain lookups removed - next queries will do full resolution');
}

function toggleHelp() {
    const glossary = document.getElementById('glossary');
    glossary.style.display = glossary.style.display === 'none' ? 'block' : 'none';
}

function clearAll() {
    activeClients.forEach(client => client.element.remove());
    activeClients = [];
    clientCounter = 0;
    document.querySelectorAll('.wire').forEach(wire => wire.remove());
    document.getElementById('activity-log').innerHTML = '';
    initializeIPPool();
    initializeDNSCache();
    resolutionSteps = [];
    dhcpSteps = [];
    updateResolutionProcess(resolutionSteps);
    updateDHCPProcess(dhcpSteps);
    log('Network simulation reset', 'All devices removed and systems reset to initial state');
}

window.addEventListener('DOMContentLoaded', function() {
    initializeIPPool();
    initializeDNSCache();
    initializeDragAndDrop();
    
    updateResolutionProcess([]);
    updateDHCPProcess([]);
    
    log('Network Lab Simulation ready!', 'Add devices and try DNS queries to learn how routers manage network services');
    
    window.addEventListener('resize', createWires);
    
    setTimeout(() => {
        createWires();
    }, 100);
    
    for (let i = 0; i < 2; i++) {
        setTimeout(() => addClient(), i * 1000 + 500);
    }

    setInterval(updateDNSCacheDisplay, 1000);
});
