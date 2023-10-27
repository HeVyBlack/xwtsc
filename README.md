#  XWTSC

- Used for: Building your Typescript project, ussing **ts file extensions** and **path aliases**

- Require: Typescript ^5.2

- To Install: `npm i -D xwtsc`

- To Use: `xwtsc [option] [verb] [flags]` or `npx xwtsc [option] [verb] [flags]`

- Options: `build` & `check` & `run` & `init`

- Verbs: `watch`

- Flags: `--tsconfig [path/to/tsconfig.json] (default: ./tsconfig.json)`

- Notes: For `run`, you must pass a file to run. To pass arguments, use --args=  `[...args]` (Must be the last flag)

## XWTSC OPTIONS

Now, you can put a new option in your tsconfig.json : xwtsc
There are three options that you can set:
|option| type | description | 
|--|--|--|
| fileToRun | string | File to run when use run option |
| fileArgs | string[] | File args that run option will use |
| nodeArgs | string[] | Node args that will be use to run a file |

