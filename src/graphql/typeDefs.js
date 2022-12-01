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
    id: ID
    messages: [Comment]
    # repliesCount: Int
  }

  type Comment {
    id: ID
    author: Profile
    text: String
    timestamp: Float
    votes: [Vote]
    votesCount: Int
    replies: [Comment]
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
    inviteCode: String
  }

  type Query {
    getProfile(id: ID!): Profile
    getProfileByAlias(alias: String!): Profile

    """
    gets the peers who have opted into publicWebHosting
    """
    getProfiles(limit: Int): [Profile]
    

    # getThread(id: ID!, preview: Boolean): Thread

    """
    get a detail on the room you paired with this api server
    (requires environment variable ROOM_ADDRESS to be present)
    """
    getMyRoom(language: String): Room
  }
`
