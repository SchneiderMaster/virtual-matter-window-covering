import { ServerNode } from "@matter/main";
import { WindowCoveringBehavior } from "@matter/main/behaviors";
import { WindowCovering } from "@matter/main/clusters";
import { WindowCoveringDevice } from "@matter/main/devices";
import * as http from 'http';

const HTTP_PORT = 3000;
const REFRESH_INTERVAL_MS = 1000;
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

const getHtmlPage = () => {
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
            overflow: hidden;
            height: 100vh;
            background-image: url("https://img.freepik.com/free-photo/beautiful-green-park_1417-1445.jpg?t=st=1764013140~exp=1764016740~hmac=bd64b53ce722c7a90dba69f340297e7fbd1e109c00b865afb0d7e529bd0a85f3&w=2000");
            background-size: cover;
            background-repeat: no-repeat;
            background-position: center center;
        }
        #roller-blind { 
            width: 100vw; 
            height: 100vh;
            background: repeat url("https://img.freepik.com/premium-vector/white-window-blinds-shade_594089-2960.jpg");
            position: absolute; 
            top: 0; 
            transform: translate(0, 0vh); 
            transition: transform 1s linear;
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
        <div id="bottom-thing"></div>
    </div>
    <script>
        const REFRESH_INTERVAL_MS = ${REFRESH_INTERVAL_MS};
        const rollerBlind = document.getElementById('roller-blind');

        const updatePosition = async () => {
            try {
                const response = await fetch('/position'); 
                const data = await response.json();
                const position100ths = data.currentPositionLiftPercent100ths;

                const positionPercent = (position100ths / 100); 
                const vhValue = 100 - positionPercent;

                rollerBlind.style.transform = \`translate(0, -\${vhValue}vh)\`;

            } catch (error) {
                console.error("Error while fetching window covering position: ", error);
            }
        };

        setInterval(updatePosition, REFRESH_INTERVAL_MS);
        
        updatePosition(); 
    </script>
</body>
</html>
`;
};

const server = http.createServer((req, res) => {
    const currentPosition = windowCoveringNode.state.windowCovering.currentPositionLiftPercent100ths;

    if (req.url === '/') {
        const htmlOutput = getHtmlPage();

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(htmlOutput);

    } else if (req.url === '/position') {
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
    console.log(`Visualisation running under: http://localhost:${HTTP_PORT}`);
});

await node.start();

process.on('SIGINT', () => {
    server.close();
    clearTimeout(updateTimemout);
})
