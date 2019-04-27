const http = require('http')
const jsonfile = require('jsonfile')
const url = require('url')
const Util = require('./util/Util')
const API = require('./util/API')
const fs = require('fs')
const spawn = require('child_process').spawn

const port = 52050
const configPath = './config.json'
const admindataPath = './admindata.json'
const dataPath = '../assets/data/data.json'

if (!fs.existsSync(admindataPath)) {
    jsonfile.writeFileSync(admindataPath, [] )
}

// spawn - `node refresh.js`
const refresh = spawn('node', ['refresh.js'], { shell: true, stdio: 'inherit'})

const server = http.createServer( (req, res) => {
    const route = url.parse(req.url).pathname
    const params = url.parse(req.url, true).query
    const { adminPassword } = jsonfile.readFileSync(configPath)

    switch (route) {
        case '/login':
            let { delay, contributors } = jsonfile.readFileSync(configPath)
            const contributorsList = []

            Util.post(req, async params => {
                const { token } = params
                if (token === adminPassword) {
                    await Promise.all(contributors.map( async contributor => {
                        const admindata = jsonfile.readFileSync('./admindata.json')
                        const existContributor = findContributor(contributor, admindata)
                        
                        if ( existContributor !== null) {
                            contributorsList.push(existContributor)
                        } else {
                            const avatarUrl = await API.getContributorAvatar(contributor)
                            if(avatarUrl !== '') {
                                contributorsList.push({
                                    username: contributor,
                                    avatarUrl: avatarUrl
                                })
                            }
                        }
                    }))

                    res.end(JSON.stringify({ code: 0, delay, contributors: contributorsList })) // success
                    jsonfile.writeFileSync(admindataPath, contributorsList)
                } else {
                    res.end(JSON.stringify({ code: 1, delay: 0, contributors: {} })) // wrong
                }
            })
           break
        case '/setInterval':
            Util.post(req, params => {
                const { token, interval } = params

                if (token !== adminPassword) {
                    res.end(JSON.stringify({ message: 'Authentication failed' }))
                } else {
                    // set delay in config.json
                    const Config = jsonfile.readFileSync(configPath)
                    Config.delay = interval
                    jsonfile.writeFileSync(configPath, Config, { spaces: 2 })

                    res.end(JSON.stringify({ message: 'Success' }))
                }
            })
            break
        case '/remove':
            Util.post(req, params => {
                const { token, username } = params

                if (token !== adminPassword) {
                    res.end(JSON.stringify({ message: 'Authentication failed' }))
                } else {
                    const Config = jsonfile.readFileSync(configPath)
                    // Remove this contributor in config.json
                    Config.contributors.forEach( (contributor, index, object) => {
                        if (contributor == username) {
                            object.splice(index, 1)
                        }
                    })
                    jsonfile.writeFileSync(configPath, Config, { spaces:2 })

                    // Remove this contributor in the data.json
                    const data = jsonfile.readFileSync(dataPath)
                    delete data[username]
                    jsonfile.writeFileSync(dataPath, data, { spaces: 2 })

                    res.end(JSON.stringify({ message: 'Success' }))
                }
            })
            break
        case '/add':
            Util.post(req, params => {
                const { token, username } = params

                if (token !== adminPassword) {
                    res.end(JSON.stringify({ message: 'Authentication failed' }))
                } else {
                    const Config = jsonfile.readFileSync(configPath)

                    if (Config.contributors.includes(username)) {
                        res.end(JSON.stringify({ message: `${username} aready exists` }))
                        return
                    }

                    // Add this contributor in config.json
                    Config.contributors.push(username)
                    jsonfile.writeFileSync(configPath, Config, { spaces:2 })

                    // Add this contributor in the data.json
                    const data = jsonfile.readFileSync(dataPath)
                    API.getContributorInfo(Config.organization, username).then( result => {
                        if (result.avatarUrl !== '' && result.issuesNumber !== -1 && result.mergedPRsNumber !== -1 && result.openPRsNumber != -1) {
                            data[`${username}`] = result
                            // Update contributors infomation
                            jsonfile.writeFile(dataPath, data, { spaces: 2 }, (err) => {
                                if (err) console.error(err)
                            })
                        }
                    })

                    API.getContributorAvatar(username).then( result => {
                        if (result === '') {
                            res.end(JSON.stringify({ message: 'Not found' }))
                        } else {
                            res.end(JSON.stringify({
                                message: 'Success',
                                avatarUrl: result
                        }))
                        }
                    })
                }
            })
            break
        default:
            res.end('Hello World!')
            break
    }
}).listen(port)


function findContributor(contributorName, admindata) {
    let result = null

    admindata.forEach( contributor => {
        if (contributor.username === contributorName) {
            result = contributor
        }
    })

    return result
}