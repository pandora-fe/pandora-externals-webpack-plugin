# pandora-externals-webpack-plugin
A webpack plugin that add externals assets to html

## Install

```bash
npm i -D pandora-externals-webpack-plugin
``` 

## Usage

In your webpack configuration (`webpack.config.js`):

```javascript
const ExternalsWebpackPlugin = require('pandora-externals-webpack-plugin');

module.exports = {
    //...
    plugins: [
        new ExternalsWebpackPlugin()
    ]
}
```


## Options

### mode

值为`'one'`或`'chunk'`。 默认值是`'chunk'`。  

`'one'`: 使用单个组件库包。  
`'chunk'`: 使用分块组件库包。  


### debug

布尔值。 默认值是`false`。  

`true`: 使用开发环境外部链接脚本，以便于调试与错误追踪。  
`false`: 使用生产环境外部链接脚本。  


### exclude
排除哪些html输出无需处理。方法 (htmlPluginData) => boolean  


### scriptsPrepend
自定义在编译脚本前添加脚本。
```
[
    { 
        path: 'https://xx.xx.js', // script路径
        attributes: {} // script属性
    },
]
```


### scriptsAppend
自定义在编译脚本后添加脚本。
```
[
    { 
        path: 'https://xx.xx.js', // script路径
        attributes: {} // script属性
    },
]
```


### externalsPath
额外的外部引用路径设置。当项目中需要添加额外的`externals`选项时，可以在这里配置路径，路径中的版本号可以使用字符串`{version}`代替。  
```
{ [name: string]: string }
```

示例：
```
{
    jquery: 'jquery/{version}/jquery.min.js'
}
```


### debugFindEntry
当发生如下错误时，是由于文件循环引用引起的。可以将`debugFindEntry`设为`true`，查看最后打印出的文件是否循环打印，用户可以打开这些文件查看是否发生循环引用。（`skipCircularReference`为`false`时才有用。）  
```
ERROR in   RangeError: Maximum call stack size exceeded
- index.js recursiveIssuerToFindEntry
    [public]/pandora-externals-webpack-plugin/index.js
```


### skipCircularReference
跳出循环引用。  
布尔值。默认为`true`。  
当文件循环引用时，可以设置该值为`true`，跳出本插件中查找Entry的循环遍历。  
设置为`false`时，可以用来配合`debugFindEntry`查找哪些文件发生了循环引用。  
还是希望大家不要有循环引用的代码。  


### skipFindEntry
不建议使用！不建议使用！不建议使用！！！  
重要的事情说三遍。  
该选项设置后将禁用分析模块属于哪个Entry。  
暂时留着作为防止遍历模块查找Entry时出现未预知的错误的急救手段，以后可能会删除。  


### processExternals
转发外部链接地址。主要用于组件库代码修改后进行本地调试。(一般无需设置)
```
function (pathInfo) {
    if (/\/pandora([\.a-zA-Z]*)\.js$/.test(pathInfo.path)) {
        pathInfo.path = `http://localhost:8088${pathInfo.path.match(/\/pandora([\.a-zA-Z]*)\.js$/)[0]}`;
    }
    return pathInfo;
}
```


### theme
主题。可以设为`'default'`或`'dark'`。


### externals.config.js
支持根目录下添加`externals.config.js`配置`externals`路径


## Example

webpack configuration (`webpack.config.js`):

```diff
const ExternalsWebpackPlugin = require('pandora-externals-webpack-plugin');

const args = require('node-args');
const mode = args.mode;

let config = {
    //...
    entry: {},
    mode,
    externals: {
        // ...
    }
}

function addEntries() {
    let pages = require('./pages.js');
    pages.forEach(function (page) {
+       config.entry[page.name] = [`${ROOT_PATH}/src/${page.name}.tsx`]; // 这里请使用数组赋值
        let plugin = new HtmlWebpackPlugin({
            filename: `${page.name}.html`,
            template: `${ROOT_PATH}/template.ejs`,
            chunks: ['manifest', 'vendor', page.name],
            favicon: `src/favicon.ico`,
+           name: page.name, // 与 `entry` 的key保持一致
            title: page.title,
            banner: {
                tag: git('tag'),
                date: new Date().toLocaleString(),
                branch: git('branch'),
            },
            IS_EXTERNALS: isExternals,
        });
        config.plugins.push(plugin);
    });
}
addEntries();

+ config.plugins.push(new ExternalsWebpackPlugin({
+     mode: mode === 'development' ? 'one' : 'chunk', // 开发环境使用单个文件，提高开发时编译效率；生产环境使用分块文件，去除未使用chunk
+     debug: mode === 'development', // 开发环境使用调试模式，方便跟踪代码
+ }));

module.exports = config;
```

>   __NOTE__: 必须在 `html-webpack-plugin` 之后添加

>   __NOTE__: 确保 `html-webpack-plugin` 的 `options.name` 的值与 `entry` 的key保持一致
