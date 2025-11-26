# Virtual Matter Window Covering

This provides a simple way of creating a **virtual window covering** that is fully integrated into the **[Matter](https://github.com/project-chip/connectedhomeip) standard**.

You can use this for fast prototyping when developing other Matter-devices and testing their interoperability.

## How to use

Using this tool requires `yarn` and `git` to be installed.

Simply execute the following to get started:
```bash
# Clone the repo
git clone https://github.com/SchneiderMaster/virtual-matter-window-covering

# Move into the repo
cd virtual-matter-window-covering

# Install all dependencies
yarn
```

To start the tool, execute the following:
```bash
yarn app
```

This creates a new window covering Matter device. A QR-Code and a code for pairing will be printed to the console. 

By opening `localhost:3000`, you will be able to find the virtual window covering. _The port can be changed by editing `HTTP_PORT` in `src/main.ts`._
