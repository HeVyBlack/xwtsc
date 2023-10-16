#  XWTSC

- Used for: Building your Typescript project, ussing **ts file extensions** and **path aliases**

- Require: Typescript ^5.2

- To Install: `npm i -D xwtsc`

- To Use: `xwtsc [option] [verb] [flags]` or `npx xwtsc [option] [verb] [flags]`

- Options: `build` & `check` & `run` & `init`

- Verbs: `watch`

- Flags: `--tsconfig [path/to/tsconfig.json] (default: ./tsconfig.json)`

- Notes: For `run`, you must pass a file to run. To pass arguments, use --args=  `[...args]` (Must be the last flag)