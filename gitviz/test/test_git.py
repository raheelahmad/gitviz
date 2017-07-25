import unittest
import pygit2
import git.filestats as fs

reponame = "/Users/raheel/Downloads/etc/fixture_repo/"

class MaxFileTests(unittest.TestCase):
    def testMaxCommits(self):
        result = fs.maxfilestats(reponame, 2)
        cCount = len(result['c.txt'])
        mCount = len(result['m.txt'])
        # for m in result['c.txt']:
        #     print(m['commit'].message)

        self.assertEqual(cCount, 12)
        self.assertEqual(mCount, 9)

    def testFileRenamingTo(self):
        repo = pygit2.Repository(reponame)
        commit = repo.get("e2e0ee1")
        renamed_to = fs.fileRenamedToAnother('a.txt', commit, reponame)
        self.assertEqual(renamed_to, "b.txt", 'a.txt should have been renamed to b.txt')
        # another
        commit = repo.get("024fc5e")
        renamed_to = fs.fileRenamedToAnother('b.txt', commit, reponame)
        self.assertEqual(renamed_to, 'c.txt', 'b.txt should have been renamed to c.txt')
    def testFileRenamingFrom(self):
        repo = pygit2.Repository(reponame)
        commit = repo.get("e2e0ee1")
        renamed_from = fs.fileRenamedFromAnother('b.txt', commit, reponame)
        self.assertEqual(renamed_from, 'a.txt', 'b.txt should have been renamed from a.txt')

    def testIsFirstCommit(self):
        self.assertTrue(fs.isFirstCommit("7f12948", reponame), 'should be the 1st commit')

    def testCommitsForDeletedFile(self):
        commits = fs.commits_for_filestat('a.txt', reponame)
        self.assertEqual(len(commits), 3, 'should have found correct # of commits for deleted file')
        commits = fs.commits_for_filestat('b.txt', reponame)
        self.assertEqual(len(commits), 3, 'should have found correct # of commits for deleted file')

if __name__ == '__main__':
    unittest.main()
