import { ServerNode } from "@matter/main";
import { WindowCoveringBehavior } from "@matter/main/behaviors";
import { WindowCovering } from "@matter/main/clusters";
import { WindowCoveringDevice } from "@matter/main/devices";
import * as http from 'http';

const HTTP_PORT = 3000;
const REFRESH_INTERVAL_MS = 1000; // Seite wird jede Sekunde neu geladen
let updateTimemout: NodeJS.Timeout;

class WindowCoveringExtension extends WindowCoveringBehavior.with(
    WindowCovering.Feature.Lift,
    WindowCovering.Feature.PositionAwareLift
) {
    override async initialize(){
        if(this.state.currentPositionLiftPercent100ths == null) {
            this.state.currentPositionLiftPercent100ths = 0;
        }
        this.state.targetPositionLiftPercent100ths = this.state.currentPositionLiftPercent100ths;
    }

    override goToLiftPercentage(request: WindowCovering.GoToLiftPercentageRequest) {
        this.state.targetPositionLiftPercent100ths = request.liftPercent100thsValue;
    }

    override async upOrOpen(){
        this.state.targetPositionLiftPercent100ths = 0;
    }

    override async downOrClose(){
        this.state.targetPositionLiftPercent100ths = 10000;
    }

    override async stopMotion(){
        this.state.targetPositionLiftPercent100ths = this.state.currentPositionLiftPercent100ths;
    }
}

const updateWindowCovering = (windowCoveringNode: any) => {
    const target = windowCoveringNode.state.windowCovering.targetPositionLiftPercent100ths;
    const current = windowCoveringNode.state.windowCovering.currentPositionLiftPercent100ths;

    if(target != current){
        const updatedValue = Math.abs(target - current) > 1000 ? (target > current ? current + 1000 : current - 1000) : target;

        console.log("updating to: ", updatedValue);
        windowCoveringNode.setStateOf(WindowCoveringExtension, {
            currentPositionLiftPercent100ths: updatedValue
        });
    }
    updateTimemout = setTimeout(() => updateWindowCovering(windowCoveringNode), 1000);
}

const windowCovering = WindowCoveringDevice.with(WindowCoveringExtension);

const node = await ServerNode.create();

const windowCoveringNode = await node.add(windowCovering);

updateWindowCovering(windowCoveringNode);

/**
 * Erstellt die HTML-Seite und injiziert den aktuellen Rollladen-Wert.
 * @param {number} position100ths - Der aktuelle Wert aus der Matter-Instanz.
 */
const getHtmlPage = () => {
    // Beachten Sie, dass hier KEIN Wert mehr injiziert wird!
    return `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: sans-serif; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            padding: 0px; 
            overflow: hidden; /* Wichtig, um Scrollbalken durch vh zu vermeiden */
            background-image: url("https://img.freepik.com/free-photo/beautiful-green-park_1417-1445.jpg?t=st=1764013140~exp=1764016740~hmac=bd64b53ce722c7a90dba69f340297e7fbd1e109c00b865afb0d7e529bd0a85f3&w=2000");
            background-size: cover;
        }
        #roller-blind { 
            width: 100vw; 
            height: 100vh;
            background: repeat url("https://img.freepik.com/premium-vector/white-window-blinds-shade_594089-2960.jpg");
            position: absolute; 
            top: 0; 
            /* Startposition bei 0% - WICHTIG: Die Position wird nun per JS gesetzt! */
            transform: translate(0, 0vh); 
            transition: transform 1s linear; /* Übergang für weichere Bewegung */
        }
        #bottom-thing {
            width: 100%;
            height: 10%;
            background: white;
            position: absolute;
            bottom: 0;
            box-shadow: black 0px 5px 10px;
        }
    </style>
</head>
<body>
    <div id="roller-blind">
    <div id="bottom-thing"></div></div>
    <script>
        const REFRESH_INTERVAL_MS = ${REFRESH_INTERVAL_MS};
        const rollerBlind = document.getElementById('roller-blind');

        const updatePosition = async () => {
            try {
                // NEU: Nur den reinen Wert vom Server abrufen
                const response = await fetch('/position'); 
                const data = await response.json();
                const position100ths = data.currentPositionLiftPercent100ths;

                // Berechne die Verschiebung in vh
                const positionPercent = (position100ths / 100); 
                const vhValue = 100 - positionPercent;

                // WICHTIG: Setze NUR das CSS-Transform-Attribut neu
                rollerBlind.style.transform = \`translate(0, -\${vhValue}vh)\`;

            } catch (error) {
                console.error("Fehler beim Abrufen der Rollladen-Position:", error);
            }
        };

        // Starte das automatische Polling (ruft den Server regelmäßig ab)
        setInterval(updatePosition, REFRESH_INTERVAL_MS);
        
        // Erste Position sofort setzen
        updatePosition(); 
    </script>
</body>
</html>
`;
};

// --- HTTP SERVER IMPLEMENTIERUNG ---

const server = http.createServer((req, res) => {
    const currentPosition = windowCoveringNode.state.windowCovering.currentPositionLiftPercent100ths;

    if (req.url === '/') {
        // Liefere die einmalig die HTML-Seite
        const htmlOutput = getHtmlPage();

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(htmlOutput);

    } else if (req.url === '/position') {
        // NEUER ENDPUNKT: Liefere nur den reinen JSON-Wert
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            currentPositionLiftPercent100ths: currentPosition! 
        }));

    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(HTTP_PORT, () => {
    console.log(`Web-Oberfläche verfügbar unter http://localhost:${HTTP_PORT}`);
});

// Run our server
await node.start();

process.on('SIGINT', () => {
    server.close();
    clearTimeout(updateTimemout);
})
