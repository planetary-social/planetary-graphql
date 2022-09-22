const gql = require('graphql-tag')

module.exports = gql`
  type Profile {
    id: ID
    name: String
    image: String
    # publicWebHosting

    threads: [Thread]
    # threads (started: Boolean): [Thread]
    # threadCount: Int
    
    followers: [Profile]
    followersCount: Int
    
    following: [Profile]
    followingCount: Int
  }

  type Thread {
    root: Comment
    replies: [Comment]
    # repliesCount: Int
  }

  type Comment {
    id: ID
    author: Profile
    text: String
    timestamp: Int
    votes: [Vote]
    # votesCount: Int
    replies: [Comment]
  }


  type Vote {
    author: Profile
    value: String  # like, heart, ghost, fire
    timestamp: Int
  }

  type Query {
    getProfile(id: ID!): Profile

    # getThread(id: ID!, preview: Boolean): Thread
    # getSample(limit: Int): [Thread]
    # getProfiles(limit: Int) [Profile]
  }
`
