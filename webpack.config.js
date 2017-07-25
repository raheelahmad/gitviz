var webpack = require('webpack')
const path = __dirname + '/gitviz/static'
const ExtractTextPlugin = require('extract-text-webpack-plugin')
module.exports = {
    entry: ['./gitviz/js/app.js', './gitviz/scss/main.scss'],
    output: {
        path: path,
        filename: 'bundle.js'
    },
    module: {
        rules: [
            {
                test: /\.scss$/,
                loader: ExtractTextPlugin.extract(
                    { fallback: 'style-loader', use: ['css-loader', 'sass-loader'] }
                ),
                exclude: /node_modules/,
            },
            {
                test: /\.js?$/,
                loader: 'babel-loader',
                query: { presets: ['es2015'] },
                exclude: /node_modules/,
            },
        ],
    },
    plugins: [new ExtractTextPlugin('[name].css'),],
}
