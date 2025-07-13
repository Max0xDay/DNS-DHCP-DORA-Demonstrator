# DNS & DHCP DORA Demonstrator

An interactive educational web simulator that visualizes and teaches fundamental networking concepts including DNS (Domain Name System) resolution and DHCP (Dynamic Host Configuration Protocol) DORA process in real-time.

## Live Demo

**Try the simulator live at:** [https://projects.penguinjelly.co.za/simulations/dns-simulator](https://projects.penguinjelly.co.za/simulations/dns-simulator)

## Aims


1. **DNS (Domain Name System) Resolution Process**
   - How domain names are translated to IP addresses
   - DNS caching mechanisms and TTL (Time To Live) concepts
   - The hierarchical DNS query process (Root → TLD → Authoritative servers)
   - Cache hits vs cache misses and their performance implications

2. **DHCP DORA Process**
   - **D**iscover: Client broadcasts for available DHCP servers
   - **O**ffer: Server offers an available IP address
   - **R**equest: Client requests the offered IP address
   - **A**cknowledge: Server confirms the IP assignment

## Features

- **DNS Cache Management**: View cached DNS entries with TTL countdown, clear cache functionality
- **Pre-loaded Domain Database**: Common websites (Google, GitHub, YouTube, etc.) with realistic IP addresses
- **IP Address Pool Management**: DHCP server manages available IP addresses (192.168.1.10-254)
- **Color-coded Packet Types**:
  - 🟢 DNS packets (green)
  - 🔴 DHCP packets (red) 
  - 🟠 Query packets (orange)
  - 🔵 Response packets (blue)

### Main Interactions

#### DNS Resolution Simulation
1. Enter a domain name in the input field (e.g., "google.com")
2. Click "DNS Query (Name Resolution)" 
3. Watch the step-by-step resolution process in the right panel
4. Observe packet animations flowing between components
5. See how DNS cache affects subsequent queries

#### DHCP DORA Process
1. Click "Add Network Device" to add a new client
2. Click "DHCP Request (Get IP Address)" or click on a client device
3. Watch the DORA process unfold in the bottom panel
4. Observe the four-step process with visual indicators


---

