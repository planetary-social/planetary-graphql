const gql = require('graphql-tag')

module.exports = gql`
  type Profile {
    id: ID
    name: String
    image: String
    description: String
    # publicWebHosting

    threads(limit: Int, threadMaxSize: Int): [Thread]
    # threads (started: Boolean): [Thread]
    # threadCount: Int
    
    followers: [Profile]
    followersCount: Int
    
    following: [Profile]
    followingCount: Int

    ssbURI: String
    aliases: [String]
  }

  type Thread {
    # id of the message
    id: ID

    # link to root message, if there is one
    root: Thread

    # message fields
    author: Profile
    text: String
    timestamp: Float
    votes: [Vote]
    votesCount: Int

    # responses
    replies: [Thread]
  }

  type Vote {
    author: Profile
    value: String  # like, heart, ghost, fire
    timestamp: Float
    expression: String
  }

  type Room {
    id: String
    multiaddress: String!
    name: String
    description: String
    members: [Profile]
    url: String
  }

  type Query {
    getProfile(id: ID!): Profile
    getProfileByAlias(alias: String!): Profile

    """
    gets the peers who have opted into publicWebHosting
    """
    getProfiles(limit: Int): [Profile]

  
    """
    gets a single thread by a messageId
    """
    getThread(msgId: ID!, maxThreadSize: Int): Thread

    """
    gets the threads by a member when an id is provided,
    or all public threads by members up to a limit (default limit is 10)
    """
    getThreads(feedId: ID, limit: Int, maxThreadSize: Int, cursor: String): [Thread]

    """
    get a detail on the room you paired with this api server
    (requires environment variable ROOM_ADDRESS to be present)
    """
    getMyRoom(language: String): Room


    """
    Sends a POST request to the rooms /create-invite endpoint and gets back
    an invite code in json
    """
    getInviteCode: String
  }
`
