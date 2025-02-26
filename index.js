'use strict';

const path = require('path');
const fs = require('fs');
const https = require('https');
const PLUGIN_NAME = 'PandoraExternalsWebpackPlugin';
const log = (msg) => console.log(`[${PLUGIN_NAME}] ${msg}`);
const warn = (msg) => console.warn(`\u001b[33m[${PLUGIN_NAME}] ${msg}\u001b[39m`);
const error = (msg) => {
    console.error(`\u001b[31mERROR: [${PLUGIN_NAME}] ${msg}\u001b[39m`);
    process.exit(1);
};
const PROJECT_PATH = process.cwd();
const EXTERNAL_PROJECT_VAR = 'pandora';

// CDN 地址
// jquery 已于组件库 15.0.0 版本移除
const CDN_FILE_PATH = {
    'core-js': 'core-js/{version}/core-js.min.js',
    '@babel/polyfill': 'babel-polyfill/{version}/polyfill.min.js',
    react: 'react/{version}/umd/react.production.min.js',
    'react-dom': 'react-dom/{version}/umd/react-dom.production.min.js',
    'react-router': 'react-router/{version}/react-router.min.js',
    'react-router-dom': 'react-router-dom/{version}/react-router-dom.min.js',
    i18next: 'i18next/{version}/i18next.min.js',
    mobx: 'mobx/{version}/mobx.umd.min.js',
    'mobx-react': 'mobx-react/{version}/index.min.js',
    jquery: 'jquery/{version}/jquery.min.js',
    lodash: 'lodash.js/{version}/lodash.min.js',
};

const CDN_FILE_PATH_DEV = {
    'core-js': 'core-js/{version}/core-js.js',
    '@babel/polyfill': 'babel-polyfill/{version}/polyfill.js',
    react: 'react/{version}/umd/react.development.js',
    'react-dom': 'react-dom/{version}/umd/react-dom.development.js',
    'react-router': 'react-router/{version}/react-router.js',
    'react-router-dom': 'react-router-dom/{version}/react-router-dom.js',
    i18next: 'i18next/{version}/i18next.js',
    mobx: 'mobx/{version}/mobx.umd.js',
    'mobx-react': 'mobx-react/{version}/index.js',
    jquery: 'jquery/{version}/jquery.js',
    lodash: 'lodash.js/{version}/lodash.js',
};

// 排序
const CDNResourceSort = ['core-js', '@babel/polyfill', 'react', 'react-dom', 'i18next', 'mobx', 'mobx-react', 'jquery', 'lodash'];

// 没有安装时从其它安装包查找
const packageSearchMapping = {
    'core-js': ['babel-config-pandora', 'babel-config-pandora-typescript'],
    '@babel/polyfill': ['babel-config-pandora', 'babel-config-pandora-typescript'],
};

function isString(value) {
    return typeof value === 'string';
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

const getTagPath = (tagObject) => {
    let { path } = tagObject;
    return path;
};

function getProjectName(externals, globalVar) {
    if (externals) {
        const defaultProjectName = 'pandora';
        if (externals[defaultProjectName] === globalVar) {
            return defaultProjectName;
        } else {
            for (let [key, value] of Object.entries(externals)) {
                if (value === globalVar) {
                    return key;
                }
            }
        }
    }
    return '';
}

function readPackage(filePath) {
    if (!fs.existsSync(filePath)) {
        error(`Cannot find file '${filePath}'`);
        return null;
    }
    return require(filePath);
}

function readProjectPackage() {
    const filePath = path.join(PROJECT_PATH, 'package.json');
    return readPackage(filePath);
}

function getAndCheckPathInstalled(projectName) {
    let filePath = path.join(PROJECT_PATH, `./node_modules/${projectName}`);
    if (!fs.existsSync(filePath)) {
        error(`${projectName} is not installed. Cannot find the path '${filePath}'`);
        return null;
    }
    return filePath;
}

function readExternalPackage(projectName) {
    let filePath = getAndCheckPathInstalled(projectName);
    filePath = path.join(filePath, 'package.json');
    return readPackage(filePath);
}

function readProjectExternalsPathConfig(debug) {
    const filePath = path.join(PROJECT_PATH, 'externals.config.js');
    if (!fs.existsSync(filePath)) {
        return {};
    }
    return require(filePath)(debug);
}

function readExternalsPathConfig(projectName, debug) {
    if (!projectName) {
        return {};
    }
    let filePath = getAndCheckPathInstalled(projectName, debug);
    filePath = path.join(filePath, 'externals.config.js');

    if (!fs.existsSync(filePath)) {
        return {};
    }
    return require(filePath)(debug);
}

function getExternalsPathConfig(projectName, debug) {
    return Object.assign({}, readExternalsPathConfig(projectName, debug), readProjectExternalsPathConfig(debug));
}

function readExternalChunkConfig(projectName) {
    let filePath = getAndCheckPathInstalled(projectName);
    filePath = path.join(filePath, 'chunk.config.js');

    if (!fs.existsSync(filePath)) {
        // when old version, `chunk.config.js` is not exist, but it's OK.
        warn(`chunk.config.js is not exist. Cannot find the path '${filePath}', are you sure?`);
        return null;
    }
    return require(filePath);
}

function readExternalWebpackExternals(projectName) {
    let filePath = getAndCheckPathInstalled(projectName);

    filePath = path.join(filePath, 'webpack.externals.js');

    if (!fs.existsSync(filePath)) {
        return null;
    }
    return require(filePath);
}

function getVersionFromDependencies(packageFile, name, withDev = true) {
    if (!packageFile) {
        return '';
    }
    let version = packageFile.dependencies && packageFile.dependencies[name];
    if (!version && withDev) {
        version = packageFile.devDependencies && packageFile.devDependencies[name];
    }
    return version || '';
}

function getVersionFromOtherPackage(name) {
    const searchPackages = packageSearchMapping[name];
    if (searchPackages && searchPackages.length > 0) {
        for (let index = 0; index < searchPackages.length; index++) {
            const searchName = searchPackages[index];
            const filePath = path.join(PROJECT_PATH, `./node_modules/${searchName}/package.json`);
            if (fs.existsSync(filePath)) {
                const packageInfo = readPackage(filePath);
                if (packageInfo.dependencies && packageInfo.dependencies[name]) {
                    const dependencyVersion = packageInfo.dependencies[name];
                    const versionMatch = dependencyVersion.match(/\d+.*/);
                    if (versionMatch) {
                        return versionMatch[0];
                    }
                }
            }
        }
    }
    return '';
}

function readBabelConfig() {
    const filePath = path.join(PROJECT_PATH, 'babel.config.js');
    if (!fs.existsSync(filePath)) {
        error(`'babel.config.js' is not exist! Cannot find the path '${filePath}'!`);
        return null;
    }
    return require(filePath);
}

function isBabelPluginTransformModulesCommonJsUsed(prompting = true) {
    const babelConfig = readBabelConfig();
    let config = babelConfig;
    if (typeof babelConfig === 'function') {
        const api = {
            cache: () => {},
            env: () => process.env.BABEL_ENV || process.env.NODE_ENV || 'development',
        };
        config = babelConfig(api);
    }
    if (config) {
        const pluginName = '@babel/plugin-transform-modules-commonjs';
        if (
            config.extends === 'babel-config-pandora' ||
            config.extends === 'babel-config-pandora-typescript'
        ) {
            return true;
        }
        if (config.plugins) {
            for (let plugin of config.plugins) {
                if (plugin === pluginName || (Array.isArray(plugin) && plugin[0] === pluginName)) {
                    return true;
                }
            }
        }
        if (prompting) {
            error(`${pluginName} is not in your babel.config.js, you should add it!`);
        }
    }
    return false;
}

function isNormalModule(module) {
    return module && module.constructor.name === 'NormalModule';
}

function recursiveIssuerToFindEntry(module, entryName, debugFindEntry, skipCircularReference, moduleExitsMap) {
    if (module.reasons && module.reasons.length > 1) {
        // 如果 reasons 有两个及以上，说明有多个 chunk 使用这个模块
        if (skipCircularReference && module.resource) {
            if (moduleExitsMap[module.resource]) {
                return false;
            } else {
                moduleExitsMap[module.resource] = true;
            }
        }
        if (debugFindEntry) {
            log(`Resource:\n${module.resource}`);
        }
        for (let reason of module.reasons) {
            let inEntry = recursiveIssuerToFindEntry(
                reason.module,
                entryName,
                debugFindEntry,
                skipCircularReference,
                moduleExitsMap
            );
            if (inEntry) {
                return true;
            }
        }
        return false;
    } else {
        if (module.issuer) {
            return recursiveIssuerToFindEntry(
                module.issuer,
                entryName,
                debugFindEntry,
                skipCircularReference,
                moduleExitsMap
            );
        } else if (module.name) {
            if (module.name === entryName) {
                return true;
            }
        }
        return false;
    }
}

function isCurrentEntryModule(module, entryName, compilation, options) {
    if (!entryName || options.skipFindEntry) {
        return true;
    }
    const isMultiEntry = compilation.entries && compilation.entries.length > 1;
    if (!isMultiEntry) {
        // 单个 Entry 时无需判断入口
        return true;
    }
    let moduleExitsMap = {};
    return recursiveIssuerToFindEntry(
        module,
        entryName,
        options.debugFindEntry,
        options.skipCircularReference,
        moduleExitsMap
    );
}

function isEmptyObject(obj) {
    return !obj || Object.keys(obj).length === 0;
}

class PandoraExternalsWebpackPlugin {
    constructor(options = {}) {
        if (typeof options.debug !== 'undefined' && typeof options.debug !== 'boolean') {
            warn('options.debug expected to be boolean!');
        }
        if (options.mode && options.mode !== 'one' && options.mode !== 'chunk') {
            warn("options.mode expected to be 'one' or 'chunk'!");
        }
        if (options.exclude && typeof options.exclude !== 'function') {
            warn('options.exclude expected to be function!');
        }
        if (options.scriptsPrepend && !Array.isArray(options.scriptsPrepend)) {
            warn('options.scriptsPrepend expected to be array!');
        }
        if (options.scriptsAppend && !Array.isArray(options.scriptsAppend)) {
            warn('options.scriptsAppend expected to be array!');
        }
        if (options.prefixUrl && typeof options.prefixUrl !== 'string') {
            warn('options.prefixUrl expected to be string!');
        }
        if (options.externalsPath && typeof options.externalsPath !== 'object') {
            warn('options.externalsPath expected to be object!');
        }
        if (options.processExternals && typeof options.processExternals !== 'function') {
            warn('options.processExternals expected to be function!');
        }
        this._options = {
            /** 调试组件库代码 */
            debug: options.debug || false,
            /** one: 使用单个组件库包；chunk: 使用分块组件库包 */
            mode: options.mode || 'chunk',
            /** 排除哪些 html 输出无需处理 */
            exclude:
                options.exclude ||
                function () {
                    return false;
                },
            scriptsPrepend: options.scriptsPrepend || [],
            scriptsAppend: options.scriptsAppend || [],
            linksPrepend: options.linksPrepend || [],
            linksAppend: options.linksAppend || [],
            metas: options.metas || [],
            htmlPluginName: options.htmlPluginName || 'html-webpack-plugin',
            prefixUrl: options.prefixUrl || Buffer.from('aHR0cHM6Ly9hc3NldHMuZ2FpYXdvcmtmb3JjZS5jb20vbGlicy8=', 'base64').toString('utf-8'),
            /** 跳过查找 Entry */
            skipFindEntry: options.skipFindEntry || false,
            /** 打印日志分析哪些文件循环引用（skipCircularReference 为 false 时才起作用） */
            debugFindEntry: options.debugFindEntry || false,
            /** 跳过循环引用 */
            skipCircularReference:
                typeof options.skipCircularReference === 'boolean' ? options.skipCircularReference : true,
            externalsPath: options.externalsPath || {},
            processExternals:
                options.processExternals ||
                function (pathInfo) {
                    return pathInfo;
                },
            theme: options.theme || 'default',
        };
        this.externalProjectName = '';
        this.externalProjectVersion = '';
        this.projectPackage = null;
        this.externalProjectPackage = null;
        this.externalsFromExternalProject = null;
        this.chunkConfig = null;
        this.jsPathMap = {};
        this.cssPathMap = {};
        this.disabledExternalProject = false;
        this.isTransformCommonJsUsed = false;
        this.externalsPathConfig = {};
        this.fetchSriHashesPromise = Promise.resolve();
    }

    fetchSriHashes() {
      if (this._options.debug) return Promise.resolve();
      return new Promise((resolve) => {
        https
          .get(
            `${this._options.prefixUrl}${this.externalProjectName}/${this.externalProjectVersion}/sri-json.json`,
            (res) => {
              let data = "";
              res.on("data", (chunk) => {
                data += chunk;
              });
              res.on("end", () => {
                try {
                  this.sriHashes = JSON.parse(data);
                  resolve();
                } catch (e) {
                  console.error("Failed to parse SRI hashes:", e);
                  resolve();
                }
              });
            }
          )
          .on("error", (err) => {
            console.error("Error fetching SRI hashes:", err);
            resolve();
          });
      });
    }

    apply(compiler) {
        const externals = compiler.options.externals;
        if (isEmptyObject(externals)) {
            warn('No externals in your webpack config, are you sure?');
        } else {
            this.externalProjectName = getProjectName(externals, EXTERNAL_PROJECT_VAR);
            if (!this.externalProjectName) {
                warn(`${EXTERNAL_PROJECT_VAR} is not in externals of your webpack config, are you sure?`);
            }

            this.externalsPathConfig = getExternalsPathConfig(this.externalProjectName, this._options.debug);

            this.isAndCheckMultipleEntry(compiler.options.entry);

            const projectPackage = readProjectPackage();
            this.isTransformCommonJsUsed = isBabelPluginTransformModulesCommonJsUsed(!!this.externalProjectName);
            let externalProjectPackage = null;
            if (this.externalProjectName) {
                externalProjectPackage = readExternalPackage(this.externalProjectName);
            }

            this.projectPackage = projectPackage;
            this.externalProjectPackage = externalProjectPackage;
            if (this.externalProjectName) {
                const pandoraVersion = externalProjectPackage ? externalProjectPackage.version : '';
                const pandoraVersionInProject = projectPackage
                    ? getVersionFromDependencies(projectPackage, this.externalProjectName)
                    : '';

                if (pandoraVersionInProject && /^[\d\.]+$/.test(pandoraVersionInProject)) {
                    if (pandoraVersion !== pandoraVersionInProject) {
                        warn(
                            `${this.externalProjectName} version in package.json (${pandoraVersionInProject}) is not same as installed in node_modules (${pandoraVersion})`
                        );
                    }
                }
                this.disabledExternalProject = false;
                if (pandoraVersion) {
                    const versionNumbers = pandoraVersion.match(/\d+/g);
                    if (versionNumbers && versionNumbers.length === 3 && parseInt(versionNumbers[0]) < 13) {
                        warn(`${this.externalProjectName} before 13.0.0 does not support external references!`);
                        this.disabledExternalProject = true;
                    }
                }
                this.externalProjectVersion = pandoraVersion;

                if (!this.disabledExternalProject) {
                    this.externalsFromExternalProject = readExternalWebpackExternals(this.externalProjectName);

                    if (this._options.mode !== 'one') {
                        this.chunkConfig = readExternalChunkConfig(this.externalProjectName);
                    }
                }
                this.fetchSriHashesPromise = this.fetchSriHashes();
            }
        }

        compiler.hooks.compilation.tap(PLUGIN_NAME, async (compilation) => {
            await this.fetchSriHashesPromise;
            // Hook into the html-webpack-plugin processing
            const onBeforeHtmlGeneration = (htmlPluginData, callback) => {
                const { exclude } = this._options;
                if (typeof exclude === 'function') {
                    if (exclude(htmlPluginData)) {
                        if (callback) {
                            callback(null, htmlPluginData);
                        } else {
                            return Promise.resolve(htmlPluginData);
                        }
                    }
                }

                const { assets } = htmlPluginData;
                // Please make sure the value of options.name in html-webpack-plugin as same as the entry name
                const entryName = htmlPluginData.plugin.options && htmlPluginData.plugin.options.name;

                const isMultipleEntry = this.isAndCheckMultipleEntry(compilation.options.entry, false);
                if (isMultipleEntry) {
                    if (!entryName || typeof entryName !== 'string') {
                        warn(
                            'Please give a string value to options.name of html-webpack-plugin, and make sure it as same as the entry name!'
                        );
                    } else {
                        if (!compilation.options.entry[entryName]) {
                            warn(
                                `The options.name of html-webpack-plugin is ${entryName}, but cannot find it in the webpack configuration.entry. Please make sure the value as same as the entry name!`
                            );
                        }
                    }
                }

                const assetPromises = [];

                const addAsset = (assetPath) => {
                    try {
                        return htmlPluginData.plugin.addFileToAssets(assetPath, compilation);
                    } catch (err) {
                        return Promise.reject(err);
                    }
                };

                const getPath = (tag) => {
                    if (isString(tag.sourcePath)) {
                        assetPromises.push(addAsset(tag.sourcePath));
                    }
                    return getTagPath(tag);
                };

                const { scriptsPrepend, scriptsAppend, linksPrepend, linksAppend, metas } = this._options;
                const { scripts: externalsScripts, css: externalsCss } = this.getExternalsCDNResource(
                    compilation,
                    entryName
                );
                const scriptsExternalsPrepend = [...scriptsPrepend, ...externalsScripts];
                const jsPrependPaths = scriptsExternalsPrepend.map(getPath);
                const jsAppendPaths = scriptsAppend.map(getPath);

                const cssExternalsPrepend = [...linksPrepend, ...externalsCss];
                const cssPrependPaths = cssExternalsPrepend.map(getPath);
                const cssAppendPaths = linksAppend.map(getPath);

                assets.js = jsPrependPaths.concat(assets.js).concat(jsAppendPaths);
                assets.css = cssPrependPaths.concat(assets.css).concat(cssAppendPaths);

                if (metas) {
                    const getMeta = (tag) => {
                        if (isString(tag.sourcePath)) {
                            assetPromises.push(addAsset(tag.sourcePath));
                        }
                        if (tag.path && isString(tag.path)) {
                            return {
                                content: getTagPath(tag),
                                ...tag.attributes,
                            };
                        } else {
                            return tag.attributes;
                        }
                    };

                    const oldOptionsMeta = htmlPluginData.plugin.options.meta || {};

                    htmlPluginData.plugin.options.meta = {
                        ...oldOptionsMeta,
                        ...metas.map(getMeta),
                    };
                }

                Promise.all(assetPromises).then(
                    () => {
                        if (callback) {
                            callback(null, htmlPluginData);
                        } else {
                            return Promise.resolve(htmlPluginData);
                        }
                    },
                    (err) => {
                        if (callback) {
                            callback(err);
                        } else {
                            return Promise.reject(err);
                        }
                    }
                );
            };

            const onAlterAssetTag = (htmlPluginData, callback) => {
                const { exclude } = this._options;
                if (typeof exclude === 'function') {
                    if (exclude(htmlPluginData)) {
                        if (callback) {
                            callback(null, htmlPluginData);
                        } else {
                            return Promise.resolve(htmlPluginData);
                        }
                    }
                }

                const { scriptsPrepend, scriptsAppend, linksPrepend, linksAppend } = this._options;
                const pluginHead = htmlPluginData.head ? htmlPluginData.head : htmlPluginData.headTags;
                const pluginBody = htmlPluginData.body ? htmlPluginData.body : htmlPluginData.bodyTags;

                const pluginLinks = pluginHead.filter(({ tagName }) => tagName === 'link');
                const pluginScripts = pluginBody.filter(({ tagName }) => tagName === 'script');

                const headPrepend = pluginLinks.slice(0, linksPrepend.length);
                const headAppend = pluginLinks.slice(pluginLinks.length - linksAppend.length);

                const bodyPrepend = pluginScripts.slice(0, scriptsPrepend.length);
                const bodyAppend = pluginScripts.slice(pluginScripts.length - scriptsAppend.length);
                const bodyAddedScripts = pluginScripts.slice(
                    scriptsPrepend.length,
                    pluginScripts.length - scriptsAppend.length
                );

                const copyTagAttributes = (tag, tagObject) => {
                    const { attributes } = tagObject;
                    if (attributes) {
                        const { attributes: tagAttributes } = tag;
                        Object.keys(attributes).forEach((attribute) => {
                            tagAttributes[attribute] = attributes[attribute];
                        });
                    }
                };

                const copyAttributes = (tags, tagObjects) => {
                    tags.forEach((tag, i) => {
                        copyTagAttributes(tag, tagObjects[i]);
                    });
                };

                copyAttributes(headPrepend.concat(headAppend), linksPrepend.concat(linksAppend));
                copyAttributes(bodyPrepend.concat(bodyAppend), scriptsPrepend.concat(scriptsAppend));
                bodyAddedScripts.forEach((externalScript) => {
                    const path = externalScript.attributes && externalScript.attributes.src;
                    if (this.jsPathMap[path]) {
                        copyTagAttributes(externalScript, this.jsPathMap[path]);
                    }
                });
                pluginLinks.forEach((externalCss) => {
                    const path = externalCss.attributes && externalCss.attributes.href;
                    if (this.cssPathMap[path]) {
                        copyTagAttributes(externalCss, this.cssPathMap[path]);
                    }
                });

                if (callback) {
                    callback(null, htmlPluginData);
                } else {
                    return Promise.resolve(htmlPluginData);
                }
            };

            if (compilation.hooks.htmlWebpackPluginBeforeHtmlGeneration) {
                compilation.hooks.htmlWebpackPluginBeforeHtmlGeneration.tapAsync(PLUGIN_NAME, onBeforeHtmlGeneration);
                compilation.hooks.htmlWebpackPluginAlterAssetTags.tapAsync(PLUGIN_NAME, onAlterAssetTag);
            } else {
                const HtmlWebpackPlugin = require(this._options.htmlPluginName);
                if (HtmlWebpackPlugin.getHooks) {
                    const hooks = HtmlWebpackPlugin.getHooks(compilation);
                    const htmlPlugins = compilation.options.plugins.filter(
                        (plugin) => plugin instanceof HtmlWebpackPlugin
                    );
                    if (htmlPlugins.length === 0) {
                        const message =
                            "Error running pandora-externals-webpack-plugin, are you sure you have html-webpack-plugin before it in your webpack config's plugins?";
                        error(message);
                    }
                    hooks.beforeAssetTagGeneration.tapAsync(PLUGIN_NAME, onBeforeHtmlGeneration);
                    hooks.alterAssetTagGroups.tapAsync(PLUGIN_NAME, onAlterAssetTag);
                } else {
                    const message =
                        "Error running pandora-externals-webpack-plugin, are you sure you have html-webpack-plugin before it in your webpack config's plugins?";
                    error(message);
                }
            }
        });
    }

    isAndCheckMultipleEntry(entry, isCheck = true) {
        if (entry) {
            const entryType = typeof entry;
            if (entryType !== 'string' && entryType !== 'object') {
                isCheck && warn(`Webpack configuration.entry expects to be an object, but it is ${entryType}`);
                return false;
            }
            if (entryType === 'object') {
                const isMultipleEntry = Object.keys(entry).length > 1;
                if (isCheck && isMultipleEntry) {
                    for (let key of Object.keys(entry)) {
                        const entryValue = entry[key];
                        const value = (entryValue && entryValue.import) || entryValue;
                        if (!Array.isArray(value)) {
                            warn(
                                `The every property of webpack configuration.entry expects to be array, but it is ${typeof value}.`
                            );
                            break;
                        }
                    }
                }
                return isMultipleEntry;
            }
        }
        return false;
    }

    generateExternalConfigPath(name, fileName, fileExt) {
        const { prefixUrl, debug, externalsPath } = this._options;

        if (externalsPath && externalsPath[name]) {
            const pathFromExternal = externalsPath[name];
            if (/^http(s*):\/\//.test(pathFromExternal)) {
                return pathFromExternal;
            }
            return `${prefixUrl}${pathFromExternal}`;
        }
        let resourcePath = '';
        if (debug) {
            resourcePath = this.externalsPathConfig[name] || CDN_FILE_PATH_DEV[name];
        }
        if (!resourcePath) {
            resourcePath = this.externalsPathConfig[name] || CDN_FILE_PATH[name];
        }
        if (!resourcePath) {
            let themeExt = '';
            if (name === EXTERNAL_PROJECT_VAR && this._options.theme && this._options.theme !== 'default') {
                themeExt = `.${this._options.theme}`;
            }
            const extraFileName = debug && name !== EXTERNAL_PROJECT_VAR ? '' : '.min';
            resourcePath = `${name}/{version}/${fileName}${themeExt}${extraFileName}${fileExt}`;
        }
        return `${prefixUrl}${resourcePath}`;
    }

    generateExternalPath(name, version, fileName, fileExt) {
        let resourcePath = this.generateExternalConfigPath(name, fileName, fileExt);
        if (/\{version\}/.test(resourcePath)) {
            let externalVersion = version;
            if (!externalVersion) {
                externalVersion = this.getVersion(name);
            }
            if (!externalVersion) {
                return '';
            }
            return resourcePath.replace(/\{version\}/, externalVersion);
        }
        return resourcePath;
    }

    generateScriptByPath(path, name, fileName) {
        if (!path) {
            return null;
        }
        let scriptInfo = {
            path,
            attributes: {
                crossorigin: true,
            },
        };
        let themeExt = '';
        if (name === EXTERNAL_PROJECT_VAR && this._options.theme && this._options.theme !== 'default') {
            themeExt = `.${this._options.theme}`;
        }
        const extraFileName = name !== EXTERNAL_PROJECT_VAR ? '' : '.min.js';
        if (path.endsWith(".js") && this.sriHashes && this.sriHashes[`${fileName}${themeExt}${extraFileName}`]) {
            scriptInfo.attributes.integrity = this.sriHashes[`${fileName}${themeExt}${extraFileName}`];
        }
        const { processExternals } = this._options;
        if (typeof processExternals === 'function') {
            scriptInfo = processExternals(scriptInfo);
        }
        this.jsPathMap[path] = scriptInfo;
        return scriptInfo;
    }

    generateExternalScript(name) {
        const path = this.generateExternalPath(name, '', name, '.js');
        return this.generateScriptByPath(path, name, name);
    }

    generateExternalProjectScript(name) {
        const path = this.generateExternalPath(EXTERNAL_PROJECT_VAR, this.externalProjectVersion, name, '.js');
        return this.generateScriptByPath(path, EXTERNAL_PROJECT_VAR, name);
    }

    generateCssByPath(path, name) {
        let cssInfo = {
            path,
            attributes: {
                crossorigin: true,
            },
        };
        let themeExt = '';
        if (name === EXTERNAL_PROJECT_VAR && this._options.theme && this._options.theme !== 'default') {
            themeExt = `.${this._options.theme}`;
        }
        if (this.sriHashes && this.sriHashes[`${name}${themeExt}.min.css`]) {
            cssInfo.attributes.integrity = this.sriHashes[`${name}${themeExt}.min.css`];
        }
        const { processExternals } = this._options;
        if (typeof processExternals === 'function') {
            cssInfo = processExternals(cssInfo);
        }
        this.cssPathMap[path] = cssInfo;
        return cssInfo;
    }

    generateExternalProjectCss(name) {
        const path = this.generateExternalPath(EXTERNAL_PROJECT_VAR, this.externalProjectVersion, name, '.css');
        return this.generateCssByPath(path, name);
    }

    getVersion(name) {
        if (name === EXTERNAL_PROJECT_VAR) {
            return this.externalProjectVersion;
        }
        let packageSort = [this.projectPackage, this.externalProjectPackage];
        let projectIndex = 0;
        if (this.externalsPathConfig[name] || CDN_FILE_PATH[name]) {
            // 在配置中的模块优先取组件库中的版本
            packageSort = [this.externalProjectPackage, this.projectPackage];
            projectIndex = 1;
        }
        let version = '';
        for (let index = 0; index < packageSort.length; index++) {
            let packageFile = packageSort[index];
            if (packageFile) {
                let versionInPackage = getVersionFromDependencies(packageFile, name, index === projectIndex);
                if (/^\^?[\d\.]+$/.test(versionInPackage)) {
                    version = versionInPackage;
                    break;
                }
            }
        }
        if (version) {
            return version.match(/^\^?([\d\.]+)$/)[1];
        }
        version = getVersionFromOtherPackage(name);
        if (version) {
            return version;
        }
        warn(`Cannot find the version of ${name}!`);
        return version;
    }

    generateScriptsFromExternals(compilation) {
        const externalsOptions = compilation.options.externals;
        if (isEmptyObject(externalsOptions)) {
            return [];
        }

        let externals = Object.assign({}, externalsOptions);

        if (this.externalProjectName && this.externalsFromExternalProject) {
            externals = Object.assign({}, this.externalsFromExternalProject, externals);
        }

        let scripts = [];
        CDNResourceSort.forEach((name) => {
            if (externals[name]) {
                let externalScript = this.generateExternalScript(name);
                if (externalScript) {
                    scripts.push(externalScript);
                }
                delete externals[name];
            }
        });
        for (let name of Object.keys(externals)) {
            if (name !== this.externalProjectName) {
                let externalScript = this.generateExternalScript(name);
                if (externalScript) {
                    scripts.push(externalScript);
                }
            }
        }
        return scripts;
    }

    hasExternalProjectInModule(module) {
        if (module && module.dependencies && module.dependencies.length > 0) {
            for (let dependency of module.dependencies) {
                if (dependency && dependency.request === this.externalProjectName) {
                    return true;
                }
            }
        }
        return false;
    }

    fillChunksUsed(sourceCode, chunksWithModules, externalsScripts, matchRegExp) {
        for (let i = chunksWithModules.length - 1; i >= 0; i--) {
            const currentChunk = chunksWithModules[i];
            // Check module exist or not
            const matchReg = matchRegExp(currentChunk);
            if (matchReg.test(sourceCode)) {
                externalsScripts.push(this.generateExternalProjectScript(currentChunk.name));
                chunksWithModules.splice(i, 1);
            }
        }
    }

    fillChunksByCommonJs(sourceCode, chunksWithModules, externalsScripts) {
        const matchProjectReg = new RegExp(
            `(^|\\s+)var\\s+(\\w+)\\s*=\\s*require\\("${escapeRegExp(this.externalProjectName)}"\\);`
        );
        const projectMatch = sourceCode.match(matchProjectReg);
        if (projectMatch) {
            let projectAlias = projectMatch[2];
            if (projectAlias) {
                projectAlias = escapeRegExp(projectAlias);
                this.fillChunksUsed(sourceCode, chunksWithModules, externalsScripts, function (chunk) {
                    // Check ${projectAlias}.${module} exist or not
                    return new RegExp(`${projectAlias}(\\.Validator)?\\.(${chunk.modules.join('|')})`);
                });
            }
        }
    }

    fillChunksByEs(sourceCode, chunksWithModules, externalsScripts) {
        const matchProjectModulesReg = new RegExp(
            `(^|\\s+)import\\s+[\\w,\\s]*\\{([^\\}]+)?\\}\\s*from\\s*["']${escapeRegExp(
                this.externalProjectName
            )}["'];*`
        );
        const projectModulesMatch = sourceCode.match(matchProjectModulesReg);
        if (projectModulesMatch) {
            let projectModules = projectModulesMatch[2];
            if (projectModules) {
                this.fillChunksUsed(projectModules, chunksWithModules, externalsScripts, function (chunk) {
                    return new RegExp(`(${chunk.modules.join('|')})\\s*(,|$)`);
                });
            }
        }
    }

    getExternalsCDNResource(compilation, entryName) {
        const { mode } = this._options;
        let externalsScripts = [];
        let externalsCss = [];

        if (this.externalProjectName && !this.disabledExternalProject) {
            externalsCss.push(this.generateExternalProjectCss(EXTERNAL_PROJECT_VAR));
        }

        externalsScripts = this.generateScriptsFromExternals(compilation);

        if (this.externalProjectName && !this.disabledExternalProject) {
            // mode === 'one' || 兼容未使用 chunkConfig 分块打包的旧组件库版本
            if (mode === 'one' || !this.chunkConfig) {
                externalsScripts.push(this.generateExternalProjectScript(EXTERNAL_PROJECT_VAR));
            } else {
                if (this.chunkConfig.cacheGroups) {
                    Object.values(this.chunkConfig.cacheGroups).forEach((commonChunk) => {
                        externalsScripts.push(this.generateExternalProjectScript(commonChunk.name));
                    });
                }

                let chunksWithModules = [];
                if (this.chunkConfig.chunkConfig) {
                    this.chunkConfig.chunkConfig.forEach((chunk) => {
                        if (chunk) {
                            if (chunk.modules && chunk.modules.length > 0) {
                                chunksWithModules.push(chunk);
                            } else {
                                externalsScripts.push(this.generateExternalProjectScript(chunk.name));
                            }
                        }
                    });
                }

                if (chunksWithModules.length > 0) {
                    const modules = compilation.modules;
                    if (modules && modules.size > 0) {
                        chunksWithModules.reverse();
                        chunksWithModules = chunksWithModules.map((chunk) => {
                            // escapeRegExp moduleName
                            chunk = Object.assign({}, chunk);
                            chunk.modules = chunk.modules.map((moduleName) => {
                                return escapeRegExp(moduleName);
                            });
                            return chunk;
                        });

                        for (let module of modules.values()) {
                            if (
                                isNormalModule(module) &&
                                this.hasExternalProjectInModule(module) &&
                                isCurrentEntryModule(module, entryName, compilation, this._options)
                            ) {
                                const sourceCode = module.originalSource().source();
                                if (this.isTransformCommonJsUsed) {
                                    this.fillChunksByCommonJs(sourceCode, chunksWithModules, externalsScripts);
                                } else {
                                    // 目前不使用@babel/plugin-transform-modules-commonjs 时，分析模块的逻辑还有点问题，暂不启用
                                    this.fillChunksByEs(sourceCode, chunksWithModules, externalsScripts);
                                }
                                if (chunksWithModules.length === 0) {
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        return {
            scripts: externalsScripts,
            css: externalsCss,
        };
    }
}

module.exports = PandoraExternalsWebpackPlugin;
