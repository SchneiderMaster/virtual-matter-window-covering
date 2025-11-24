import { ServerNode } from "@matter/main";
import { WindowCoveringBehavior } from "@matter/main/behaviors";
import { WindowCovering } from "@matter/main/clusters";
import { WindowCoveringDevice } from "@matter/main/devices";
import * as http from 'http';

const HTTP_PORT = 3000;
const REFRESH_INTERVAL_MS = 1000; // Seite wird jede Sekunde neu geladen

class WindowCoveringExtension extends WindowCoveringBehavior.with(
    WindowCovering.Feature.Lift,
    WindowCovering.Feature.PositionAwareLift
) {
    override async initialize(){
        
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
    setTimeout(() => updateWindowCovering(windowCoveringNode), 1000);
}

const windowCovering = WindowCoveringDevice.with(WindowCoveringExtension);

const node = await ServerNode.create();

const windowCoveringNode = await node.add(windowCovering);

updateWindowCovering(windowCoveringNode);

/**
 * Erstellt die HTML-Seite und injiziert den aktuellen Rollladen-Wert.
 * @param {number} position100ths - Der aktuelle Wert aus der Matter-Instanz.
 */
const getHtmlPage = (position100ths: number) => {
    // Berechne die Prozentwerte für die Visualisierung
    const positionPercent = (position100ths / 100);  

    return `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; padding: 0px; }
        #roller-blind { 
            width: 100vw; 
            height: 100vh;
            background: repeat url("https://img.freepik.com/premium-vector/white-window-blinds-shade_594089-2960.jpg");
            position: absolute; 
            top: 0; 
            /* WICHTIG: Die Höhe wird direkt in das HTML injiziert */
            transform: translate(0, -${100-positionPercent}vh);
            transition: height 0.5s ease-out; /* Für die Animation */
        }
        #bottom-thing {
            width: 100%;
            height: 10%;
            background: white;
            position: relative;
            bottom: 0;
        }
    </style>
</head>
<body>
    <div id="roller-blind">
    <div id="bottom-thing"/></div>
    <script>
        // Startet das automatische Polling (Seite neu laden)
        setTimeout(() => {
            // Lädt die Seite neu, was den Node-Server zwingt, 
            // das HTML mit dem NEUEN, aktuellen Wert zu erstellen.
            window.location.reload(true); 
        }, ${REFRESH_INTERVAL_MS});
    </script>
</body>
</html>
`;
};

// --- HTTP SERVER IMPLEMENTIERUNG ---

const server = http.createServer((req, res) => {
    if (req.url === '/') {
        // 1. Hole den Wert direkt aus der Matter-Instanz
        const currentPosition = windowCoveringNode.state.windowCovering.currentPositionLiftPercent100ths;
        
        // 2. Erstelle das HTML mit dem aktuellen Wert (Injektion)
        const htmlOutput = getHtmlPage(currentPosition!);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(htmlOutput);

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
